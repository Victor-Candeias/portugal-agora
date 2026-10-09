package pt.portugalhoje.auto.api

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File
import java.io.IOException

// Serviços Públicos (PSP/GNR/outras polícias) — o mesmo `.sqlite` estático que a web e o mobile
// usam (WEB-023, gerado a partir do OpenStreetMap e publicado 1×/dia no GitHub Pages).
// É guardado em filesDir e reutilizado offline; re-descarrega no máximo uma vez por dia.
object PublicServicesApi {
    private const val URL = "https://victor-candeias.github.io/portugal-agora/data/public-services.sqlite"
    private const val FILE_NAME = "public-services.sqlite"
    private const val REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000L

    private val mutex = Mutex()

    val CATEGORY_LABELS = mapOf(
        "police_psp" to "PSP",
        "police_gnr" to "GNR",
        "police_municipal" to "Polícia Municipal",
        "police_maritime" to "Polícia Marítima",
        "police_other" to "Polícia",
    )

    suspend fun getAll(context: Context): List<PublicService> = withContext(Dispatchers.IO) {
        val file = mutex.withLock { ensureFile(context) }
        SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY).use { db ->
            db.rawQuery(
                """SELECT name, category, address, locality, municipality, phone, latitude, longitude
                   FROM public_services
                   WHERE latitude IS NOT NULL AND longitude IS NOT NULL""",
                null,
            ).use { cursor ->
                buildList {
                    while (cursor.moveToNext()) {
                        add(
                            PublicService(
                                name = cursor.getString(0),
                                category = cursor.getString(1),
                                address = cursor.getString(2),
                                locality = cursor.getString(3),
                                municipality = cursor.getString(4),
                                phone = cursor.getString(5),
                                latitude = cursor.getDouble(6),
                                longitude = cursor.getDouble(7),
                            ),
                        )
                    }
                }
            }
        }
    }

    private fun ensureFile(context: Context): File {
        val file = File(context.filesDir, FILE_NAME)
        val isFresh = file.exists() && System.currentTimeMillis() - file.lastModified() < REFRESH_INTERVAL_MS
        if (isFresh) return file

        val error = runCatching { download(context, file) }.exceptionOrNull() ?: return file
        if (file.exists()) return file
        throw IOException(
            "Os dados de Serviços Públicos ainda não estão disponíveis. " +
                "Liga-te à internet para os descarregar — só é preciso uma vez.",
            error,
        )
    }

    /** Descarrega para um temporário, valida que é o SQLite esperado e só então substitui o atual. */
    private fun download(context: Context, destination: File) {
        val tmp = File(context.cacheDir, "$FILE_NAME.download")
        try {
            ApiClient.client.newCall(Request.Builder().url(URL).build()).execute().use { response ->
                if (!response.isSuccessful) throw IOException("HTTP ${response.code}")
                val body = response.body ?: throw IOException("Empty response body")
                tmp.outputStream().use { out -> body.byteStream().use { it.copyTo(out) } }
            }
            SQLiteDatabase.openDatabase(tmp.path, null, SQLiteDatabase.OPEN_READONLY).use { db ->
                db.rawQuery("SELECT COUNT(*) FROM public_services", null).use { it.moveToFirst() }
            }
            tmp.copyTo(destination, overwrite = true)
        } finally {
            tmp.delete()
        }
    }
}

data class PublicService(
    val name: String,
    val category: String,
    val address: String?,
    val locality: String?,
    val municipality: String?,
    val phone: String?,
    val latitude: Double,
    val longitude: Double,
)
