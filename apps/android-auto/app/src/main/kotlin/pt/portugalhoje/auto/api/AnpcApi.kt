package pt.portugalhoje.auto.api

import pt.portugalhoje.auto.BuildConfig

object AnpcApi {
    private const val URL = "https://api.apiaberta.pt/v1/anpc/incidents"

    suspend fun getIncidents(): List<AnpcIncident> {
        val json = ApiClient.get(
            url = URL,
            headers = mapOf("X-API-Key" to BuildConfig.APIABERTA_KEY),
        )
        return ApiClient.gson.fromJson(json, AnpcResponse::class.java).data.orEmpty()
    }
}

data class AnpcResponse(
    val data: List<AnpcIncident>? = emptyList(),
)

data class AnpcIncident(
    val id: String = "",
    val status: String = "",
    val type: String = "",
    val location: AnpcLocation = AnpcLocation(),
    val resources: AnpcResources = AnpcResources(),
)

data class AnpcLocation(
    val district: String = "",
    val address: String = "",
    val lat: Double = 0.0,
    val lng: Double = 0.0,
)

data class AnpcResources(
    val ground: Int = 0,
    val aerial: Int = 0,
)
