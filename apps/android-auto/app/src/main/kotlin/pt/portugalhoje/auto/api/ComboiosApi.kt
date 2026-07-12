package pt.portugalhoje.auto.api

object ComboiosApi {
    private const val URL = "https://comboios.live/api/vehicles"

    suspend fun getVehicles(): List<TrainVehicle> {
        val json = ApiClient.get(URL)
        return ApiClient.gson.fromJson(json, ComboiosResponse::class.java).vehicles.orEmpty()
    }
}

data class ComboiosResponse(
    val vehicles: List<TrainVehicle>? = emptyList(),
)

data class TrainVehicle(
    val trainNumber: Int = 0,
    val delay: Int = 0,
    val status: String = "",
    val service: TrainDescriptor = TrainDescriptor(),
    val origin: TrainDescriptor = TrainDescriptor(),
    val destination: TrainDescriptor = TrainDescriptor(),
)

data class TrainDescriptor(
    val designation: String = "",
)
