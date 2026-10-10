package pt.portugalhoje.car.api

import pt.portugalhoje.car.BuildConfig

// Tarifas de carregamento dos CEME (API Aberta). Mesmo endpoint que o mobile (useCheapestEvTariffs).
object EvApi {
    private const val URL = "https://api.apiaberta.pt/v1/ev/tariffs/cheapest"

    suspend fun getCheapest(kwh: Int): EvCheapestResponse {
        val headers = BuildConfig.APIABERTA_KEY.takeIf { it.isNotBlank() }
            ?.let { mapOf("X-API-Key" to it) }
            .orEmpty()
        val json = ApiClient.get("$URL?kwh=$kwh", headers)
        return ApiClient.gson.fromJson(json, EvCheapestResponse::class.java)
    }
}

data class EvCheapestResponse(
    val data: List<EvChargeCost>? = emptyList(),
    val meta: EvCheapestMeta? = null,
)

data class EvCheapestMeta(
    val kwh_requested: Double = 0.0,
    val current_period: String? = null,
)

data class EvChargeCost(
    val ceme: String = "",
    val price_per_kwh_eur: Double = 0.0,
    val activation_fee_eur: Double = 0.0,
    val total_cost_eur: Double = 0.0,
    val period: String? = null,
)
