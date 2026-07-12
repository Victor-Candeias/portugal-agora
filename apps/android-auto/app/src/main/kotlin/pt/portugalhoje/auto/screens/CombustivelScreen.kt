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
import pt.portugalhoje.auto.api.DgegApi
import pt.portugalhoje.auto.api.DgegStation
import pt.portugalhoje.auto.utils.LocationHelper
import java.util.Locale

class CombustivelScreen(carContext: CarContext) : Screen(carContext) {
    private val apiScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val locale = Locale("pt", "PT")
    private var requested = false
    private var loading = true
    private var stations: List<StationWithDistance> = emptyList()
    private var errorMessage: String? = null

    override fun onGetTemplate(): Template {
        ensureLoaded()

        errorMessage?.let {
            return MessageTemplate.Builder(it)
                .setTitle("Combustível")
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (loading) {
            return PlaceListMapTemplate.Builder()
                .setTitle("Combustível")
                .setHeaderAction(Action.BACK)
                .setLoading(true)
                .build()
        }

        if (stations.isEmpty()) {
            return MessageTemplate.Builder("Sem postos disponíveis.")
                .setTitle("Combustível")
                .setHeaderAction(Action.BACK)
                .build()
        }

        val itemList = ItemList.Builder().apply {
            stations.forEach { station ->
                val place = Place.Builder(
                    CarLocation.create(station.station.Latitude, station.station.Longitude),
                ).build()

                addItem(
                    Row.Builder()
                        .setTitle(station.station.Nome.ifBlank { station.station.Marca.ifBlank { "Posto ${station.station.Id}" } })
                        .addText("${formatDistance(station.distanceKm)} · ${station.station.Preco}")
                        .addText(station.station.Morada.ifBlank { "${station.station.Municipio}, ${station.station.Distrito}" })
                        .setMetadata(Metadata.Builder().setPlace(place).build())
                        .build(),
                )
            }
        }.build()

        return PlaceListMapTemplate.Builder()
            .setTitle("Combustível")
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
                    DgegApi.getStations()
                        .filter { it.Latitude != 0.0 || it.Longitude != 0.0 }
                        .map { station ->
                            StationWithDistance(
                                station = station,
                                distanceKm = LocationHelper.distanceKm(
                                    baseLat,
                                    baseLng,
                                    station.Latitude,
                                    station.Longitude,
                                ),
                            )
                        }
                        .sortedBy { it.distanceKm }
                        .take(10)
                }
            }.onSuccess { result ->
                stations = result
                loading = false
            }.onFailure { throwable ->
                errorMessage = throwable.message ?: "Não foi possível carregar os postos."
                loading = false
            }
            invalidate()
        }
    }

    private fun formatDistance(distanceKm: Double): String = String.format(locale, "%.1f km", distanceKm)

    private data class StationWithDistance(
        val station: DgegStation,
        val distanceKm: Double,
    )

    private companion object {
        const val LISBON_LAT = 38.72
        const val LISBON_LNG = -9.14
    }
}
