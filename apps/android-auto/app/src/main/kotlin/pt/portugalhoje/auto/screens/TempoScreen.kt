package pt.portugalhoje.auto.screens

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Pane
import androidx.car.app.model.PaneTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pt.portugalhoje.auto.api.IpmaApi
import pt.portugalhoje.auto.api.IpmaForecastDay
import pt.portugalhoje.auto.utils.LocationHelper

class TempoScreen(carContext: CarContext) : Screen(carContext) {
    private val apiScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var requested = false
    private var loading = true
    private var errorMessage: String? = null
    private var cityName: String = "Lisboa"
    private var forecast: List<IpmaForecastDay> = emptyList()

    override fun onGetTemplate(): Template {
        ensureLoaded()

        errorMessage?.let {
            return MessageTemplate.Builder(it)
                .setTitle("Tempo")
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (loading) {
            return PaneTemplate.Builder(
                Pane.Builder()
                    .setLoading(true)
                    .build(),
            )
                .setTitle("Tempo")
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (forecast.isEmpty()) {
            return MessageTemplate.Builder("Sem previsão disponível.")
                .setTitle("Tempo")
                .setHeaderAction(Action.BACK)
                .build()
        }

        val today = forecast.first()
        val nextDays = forecast.drop(1).take(3)

        val pane = Pane.Builder()
            .addRow(
                Row.Builder()
                    .setTitle(cityName)
                    .addText(today.weatherDescription)
                    .addText("Hoje: mín ${formatTemp(today.tMin)} · máx ${formatTemp(today.tMax)} · chuva ${today.precipitaProb.toInt()}%")
                    .build(),
            )
            .apply {
                nextDays.forEach { day ->
                    addRow(
                        Row.Builder()
                            .setTitle(day.forecastDate)
                            .addText("${formatTemp(day.tMin)} / ${formatTemp(day.tMax)} · ${day.precipitaProb.toInt()}%")
                            .addText(day.weatherDescription)
                            .build(),
                    )
                }
            }
            .build()

        return PaneTemplate.Builder(pane)
            .setTitle("Tempo")
            .setHeaderAction(Action.BACK)
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
                    val city = IPMA_CITIES.minByOrNull { candidate ->
                        LocationHelper.distanceKm(baseLat, baseLng, candidate.lat, candidate.lng)
                    } ?: IPMA_CITIES.first()
                    cityName = city.name
                    IpmaApi.getForecast(city.id)
                }
            }.onSuccess { result ->
                forecast = result
                loading = false
            }.onFailure { throwable ->
                errorMessage = throwable.message ?: "Não foi possível carregar a previsão."
                loading = false
            }
            invalidate()
        }
    }

    private fun formatTemp(value: Double): String = "${value.toInt()}°C"

    private data class IpmaCity(
        val id: Int,
        val name: String,
        val lat: Double,
        val lng: Double,
    )

    private companion object {
        const val LISBON_LAT = 38.72
        const val LISBON_LNG = -9.14

        val IPMA_CITIES = listOf(
            IpmaCity(1110600, "Lisboa", 38.72, -9.14),
            IpmaCity(1131200, "Porto", 41.15, -8.61),
            IpmaCity(1080500, "Faro", 37.02, -7.93),
            IpmaCity(1060300, "Coimbra", 40.21, -8.43),
            IpmaCity(1030300, "Braga", 41.55, -8.43),
            IpmaCity(1010500, "Aveiro", 40.64, -8.65),
            IpmaCity(1070500, "Évora", 38.57, -7.91),
        )
    }
}
