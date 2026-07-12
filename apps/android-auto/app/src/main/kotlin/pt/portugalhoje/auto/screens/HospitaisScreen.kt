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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pt.portugalhoje.auto.api.SnsApi
import pt.portugalhoje.auto.api.SnsHospitalRecord
import pt.portugalhoje.auto.utils.LocationHelper
import java.util.Locale

class HospitaisScreen(carContext: CarContext) : Screen(carContext) {
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
            hospitals.forEach { h: HospitalWithDistance ->
                val lat = h.hospital.localizacao_geografica?.lat ?: 0.0
                val lon = h.hospital.localizacao_geografica?.lon ?: 0.0
                val place = Place.Builder(CarLocation.create(lat, lon)).build()
                addItem(
                    Row.Builder()
                        .setTitle(h.hospital.nome_do_servico_de_urgencia)
                        .addText("${formatDistance(h.distanceKm)} · ${h.hospital.tipo_de_urgencia}")
                        .addText(h.hospital.localidade)
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

    private fun ensureLoaded() {
        if (requested) return
        requested = true
        lifecycleScope.launch {
            loading = true
            errorMessage = null
            runCatching {
                withContext(Dispatchers.IO) {
                    val location = LocationHelper.getLocation(carContext)
                    val baseLat = location?.latitude ?: LISBON_LAT
                    val baseLng = location?.longitude ?: LISBON_LNG
                    SnsApi.getHospitals()
                        .filter { (it.localizacao_geografica?.lat ?: 0.0) != 0.0 }
                        .map { hospital: SnsHospitalRecord ->
                            val hLat = hospital.localizacao_geografica?.lat ?: 0.0
                            val hLon = hospital.localizacao_geografica?.lon ?: 0.0
                            HospitalWithDistance(
                                hospital = hospital,
                                distanceKm = LocationHelper.distanceKm(baseLat, baseLng, hLat, hLon),
                            )
                        }
                        .sortedBy { it.distanceKm }
                        .take(6)
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

    private fun formatDistance(km: Double) = String.format(locale, "%.1f km", km)

    private data class HospitalWithDistance(val hospital: SnsHospitalRecord, val distanceKm: Double)

    companion object {
        private const val LISBON_LAT = 38.72
        private const val LISBON_LNG = -9.14
    }
}
