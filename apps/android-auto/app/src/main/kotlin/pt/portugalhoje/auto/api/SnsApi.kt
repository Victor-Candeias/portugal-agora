package pt.portugalhoje.auto.api

object SnsApi {
    private const val URL = "https://transparencia.sns.gov.pt/api/explore/v2.1/catalog/datasets/caracterizacao-das-valencias-de-urgencia/records?limit=100"

    suspend fun getHospitals(): List<SnsHospitalRecord> {
        val json = ApiClient.get(URL)
        return ApiClient.gson.fromJson(json, SnsResponse::class.java).results.orEmpty()
    }
}

data class SnsResponse(
    val results: List<SnsHospitalRecord>? = emptyList(),
)

data class SnsHospitalRecord(
    val nome_do_servico_de_urgencia: String = "",
    val tipo_de_urgencia: String = "",
    val localidade: String = "",
    val endereco: String = "",
    val localizacao_geografica: SnsGeo? = null,
)

data class SnsGeo(
    val lat: Double = 0.0,
    val lon: Double = 0.0,
)
