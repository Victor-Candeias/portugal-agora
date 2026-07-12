package pt.portugalhoje.auto.api

object IpmaApi {
    suspend fun getForecast(cityId: Int): List<IpmaForecastDay> {
        val json = ApiClient.get("https://api.ipma.pt/open-data/forecast/meteorology/cities/daily/$cityId.json")
        val response = ApiClient.gson.fromJson(json, IpmaResponse::class.java)
        return response.data.orEmpty().map { raw ->
            IpmaForecastDay(
                forecastDate = raw.forecastDate,
                tMin = raw.tMin?.toDoubleOrNull() ?: 0.0,
                tMax = raw.tMax?.toDoubleOrNull() ?: 0.0,
                idWeatherType = raw.idWeatherType,
                precipitaProb = raw.precipitaProb?.toDoubleOrNull() ?: 0.0,
                weatherDescription = describeWeatherType(raw.idWeatherType),
            )
        }
    }

    fun describeWeatherType(idWeatherType: Int): String = when (idWeatherType) {
        1 -> "Céu limpo ☀️"
        2 -> "Pouco nublado 🌤️"
        3 -> "Parcialmente nublado ⛅"
        4 -> "Muito nublado ☁️"
        6 -> "Aguaceiros 🌧️"
        9 -> "Chuva 🌧️"
        11 -> "Chuva forte ⛈️"
        14 -> "Chuva e trovoada ⛈️"
        18 -> "Neve 🌨️"
        25 -> "Nevoeiro 🌫️"
        else -> "Sem informação 🌤️"
    }
}

data class IpmaResponse(
    val data: List<IpmaForecastRaw>? = emptyList(),
)

data class IpmaForecastRaw(
    val forecastDate: String = "",
    val tMin: String? = null,
    val tMax: String? = null,
    val idWeatherType: Int = 0,
    val precipitaProb: String? = null,
)

data class IpmaForecastDay(
    val forecastDate: String,
    val tMin: Double,
    val tMax: Double,
    val idWeatherType: Int,
    val precipitaProb: Double,
    val weatherDescription: String,
)
