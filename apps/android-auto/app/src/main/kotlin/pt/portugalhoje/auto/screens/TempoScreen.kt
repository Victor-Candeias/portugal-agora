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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pt.portugalhoje.auto.api.IpmaApi
import pt.portugalhoje.auto.api.IpmaForecastDay
import pt.portugalhoje.auto.utils.LocationHelper

class TempoScreen(carContext: CarContext) : Screen(carContext) {
    private var requested = false
    private var loading = true
    private var forecasts: List<IpmaForecastDay> = emptyList()
    private var cityName: String = "Lisboa"
    private var errorMessage: String? = null

    private data class IpmaCity(val id: Int, val name: String, val lat: Double, val lng: Double)

    override fun onGetTemplate(): Template {
        ensureLoaded()

        errorMessage?.let {
            return MessageTemplate.Builder(it)
                .setTitle("Tempo")
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (loading) {
            return PaneTemplate.Builder(Pane.Builder().setLoading(true).build())
                .setTitle("Tempo")
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (forecasts.isEmpty()) {
            return MessageTemplate.Builder("Sem previsão disponível.")
                .setTitle("Tempo")
                .setHeaderAction(Action.BACK)
                .build()
        }

        val rows = forecasts.take(4).map { f ->
            val weather = weatherDesc(f.idWeatherType)
            Row.Builder()
                .setTitle("${f.forecastDate}  $weather")
                .addText("${f.tMin}°C – ${f.tMax}°C  💧${f.precipitaProb}%")
                .build()
        }

        val pane = Pane.Builder().apply { rows.forEach { addRow(it) } }.build()

        return PaneTemplate.Builder(pane)
            .setTitle("Tempo — $cityName")
            .setHeaderAction(Action.BACK)
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
                    val baseLat = location?.latitude ?: 38.72
                    val baseLng = location?.longitude ?: -9.14
                    val city = IPMA_CITIES.minByOrNull { LocationHelper.distanceKm(baseLat, baseLng, it.lat, it.lng) }
                        ?: IPMA_CITIES.first()
                    Pair(city.name, IpmaApi.getForecast(city.id))
                }
            }.onSuccess { (name, data) ->
                cityName = name
                forecasts = data
                loading = false
            }.onFailure { throwable ->
                errorMessage = throwable.message ?: "Não foi possível carregar a previsão."
                loading = false
            }
            invalidate()
        }
    }

    private fun weatherDesc(id: Int): String = when (id) {
        1 -> "☀️"; 2 -> "🌤️"; 3 -> "⛅"; 4, 5 -> "☁️"
        6, 7, 8 -> "🌧️"; 9, 10 -> "🌧️"; 11, 12 -> "⛈️"
        14 -> "⛈️"; 18 -> "🌨️"; 25, 26, 27 -> "🌫️"
        else -> "🌡️"
    }

    companion object {
        private data class IpmaCity(val id: Int, val name: String, val lat: Double, val lng: Double)
        private val IPMA_CITIES = listOf(
            IpmaCity(1010500, "Aveiro",           40.64, -8.65),
            IpmaCity(1020500, "Beja",              38.02, -7.86),
            IpmaCity(1030300, "Braga",             41.55, -8.43),
            IpmaCity(1040200, "Bragança",          41.81, -6.76),
            IpmaCity(1050200, "Castelo Branco",    39.82, -7.49),
            IpmaCity(1060300, "Coimbra",           40.21, -8.43),
            IpmaCity(1070500, "Évora",             38.57, -7.91),
            IpmaCity(1080500, "Faro",              37.02, -7.93),
            IpmaCity(1090700, "Guarda",            40.54, -7.27),
            IpmaCity(1100900, "Leiria",            39.74, -8.81),
            IpmaCity(1110600, "Lisboa",            38.72, -9.14),
            IpmaCity(1121400, "Setúbal",           38.52, -8.89),
            IpmaCity(1131200, "Porto",             41.15, -8.61),
            IpmaCity(1141600, "Viana do Castelo",  41.70, -8.83),
            IpmaCity(1151200, "Vila Real",         41.30, -7.74),
            IpmaCity(1160900, "Viseu",             40.66, -7.91),
            IpmaCity(1182300, "Santarém",          39.24, -8.69),
            IpmaCity(1171400, "Portalegre",        39.30, -7.43),
        )
    }
}
