package pt.portugalhoje.car.api

import java.io.IOException

object DgegApi {
    private const val URL = "https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb/PesquisarPostos?idsTiposComb=3201&qtdPorPagina=9999&pagina=1"

    suspend fun getStations(): List<DgegStation> {
        val json = ApiClient.get(URL)
        val response = ApiClient.gson.fromJson(json, DgegResponse::class.java)
        if (!response.status) throw IOException(response.mensagem ?: "Erro na API da DGEG")
        return response.resultado.orEmpty()
    }
}

data class DgegResponse(
    val status: Boolean = false,
    val mensagem: String? = null,
    val resultado: List<DgegStation>? = emptyList(),
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
