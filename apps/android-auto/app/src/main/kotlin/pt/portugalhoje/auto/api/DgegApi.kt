package pt.portugalhoje.auto.api

object DgegApi {
    private const val URL = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/ListarPostos?idsTiposComb=3201&qtdPorPagina=50&pagina=1"

    suspend fun getStations(): List<DgegStation> {
        val json = ApiClient.get(URL)
        return ApiClient.gson.fromJson(json, DgegResponse::class.java).resultado?.items.orEmpty()
    }
}

data class DgegResponse(
    val resultado: DgegResult? = null,
)

data class DgegResult(
    val items: List<DgegStation>? = emptyList(),
)

data class DgegStation(
    val Id: Long = 0,
    val Nome: String = "",
    val Marca: String = "",
    val Municipio: String = "",
    val Distrito: String = "",
    val Morada: String = "",
    val Preco: String = "",
    val Latitude: Double = 0.0,
    val Longitude: Double = 0.0,
)
