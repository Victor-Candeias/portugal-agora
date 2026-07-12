package pt.portugalhoje.auto.screens

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.CarLocation
import androidx.car.app.model.ItemList
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Metadata
import androidx.car.app.model.Place
import androidx.car.app.model.PlaceListMapTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pt.portugalhoje.auto.api.SnsApi
import pt.portugalhoje.auto.api.SnsHospitalRecord
import pt.portugalhoje.auto.utils.LocationHelper
import java.util.Locale

class HospitaisScreen(carContext: CarContext) : Screen(carContext) {
    private val apiScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val locale = Locale("pt", "PT")
    private var requested = false
    private var loading = true
    private var hospitals: List<HospitalWithDistance> = emptyList()
    private var errorMessage: String? = null

    override fun onGetTemplate(): Template {
        ensureLoaded()

        errorMessage?.let {
            return MessageTemplate.Builder(it)
                .setTitle("Hospitais SNS")
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (loading) {
            return PlaceListMapTemplate.Builder()
                .setTitle("Hospitais SNS")
                .setHeaderAction(Action.BACK)
                .setLoading(true)
                .build()
        }

        if (hospitals.isEmpty()) {
            return MessageTemplate.Builder("Sem hospitais disponíveis.")
                .setTitle("Hospitais SNS")
                .setHeaderAction(Action.BACK)
                .build()
        }

        val itemList = ItemList.Builder().apply {
            hospitals.forEach { hospital ->
                val geo = hospital.record.localizacao_geografica ?: return@forEach
                val place = Place.Builder(CarLocation.create(geo.lat, geo.lon)).build()

                addItem(
                    Row.Builder()
                        .setTitle(hospital.record.nome_do_servico_de_urgencia)
                        .addText("${hospital.record.tipo_de_urgencia} · ${formatDistance(hospital.distanceKm)}")
                        .addText(hospital.record.endereco.ifBlank { hospital.record.localidade })
                        .setMetadata(Metadata.Builder().setPlace(place).build())
                        .build(),
                )
            }
        }.build()

        return PlaceListMapTemplate.Builder()
            .setTitle("Hospitais SNS")
            .setHeaderAction(Action.BACK)
            .setCurrentLocationEnabled(true)
            .setItemList(itemList)
            .build()
    }

    override fun onDestroy() {
        apiScope.cancel()
        super.onDestroy()
    }

    private fun ensureLoaded() {
        if (requested) {
            return
        }
        requested = true
        lifecycleScope.launch {
            loading = true
            errorMessage = null
            runCatching {
                withContext(apiScope.coroutineContext) {
                    val location = LocationHelper.getLocation(carContext)
                    val baseLat = location?.latitude ?: LISBON_LAT
                    val baseLng = location?.longitude ?: LISBON_LNG
                    val deduplicated = linkedMapOf<String, SnsHospitalRecord>()
                    SnsApi.getHospitals()
                        .filter { it.localizacao_geografica != null }
                        .forEach { record ->
                            deduplicated.putIfAbsent(record.nome_do_servico_de_urgencia, record)
                        }

                    deduplicated.values
                        .mapNotNull { record ->
                            val geo = record.localizacao_geografica ?: return@mapNotNull null
                            HospitalWithDistance(
                                record = record,
                                distanceKm = LocationHelper.distanceKm(baseLat, baseLng, geo.lat, geo.lon),
                            )
                        }
                        .sortedBy { it.distanceKm }
                        .take(10)
                }
            }.onSuccess { result ->
                hospitals = result
                loading = false
            }.onFailure { throwable ->
                errorMessage = throwable.message ?: "Não foi possível carregar os hospitais."
                loading = false
            }
            invalidate()
        }
    }

    private fun formatDistance(distanceKm: Double): String = String.format(locale, "%.1f km", distanceKm)

    private data class HospitalWithDistance(
        val record: SnsHospitalRecord,
        val distanceKm: Double,
    )

    private companion object {
        const val LISBON_LAT = 38.72
        const val LISBON_LNG = -9.14
    }
}
