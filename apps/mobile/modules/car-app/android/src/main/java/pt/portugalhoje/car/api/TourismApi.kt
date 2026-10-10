package pt.portugalhoje.car.api

import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import okhttp3.HttpUrl.Companion.toHttpUrl
import pt.portugalhoje.car.utils.LocationHelper

// Pontos de interesse turístico — porta Kotlin de packages/core/src/api/{tourism,sigtur,icnf,unesco}.ts
// (SIGTUR/TravelBI e ICNF via ArcGIS REST, UNESCO estático).
object TourismApi {
    private const val SIGTUR_BASE = "https://geo.turismodeportugal.pt/server/rest/services/TDP"
    private const val ICNF_BASE = "https://sigservices.icnf.pt/server/rest/services/BDG"

    private enum class Source { SIGTUR, ICNF }

    private data class Layer(
        val source: Source,
        val category: String,
        val service: String,
        val layerId: Int,
        val serverType: String = "FeatureServer",
        val subcategory: String? = null,
    )

    private val LAYERS = listOf(
        Layer(Source.SIGTUR, "health-wellness", "SIGTUR_TurismoSaudeBemEstar", 27),
        Layer(Source.SIGTUR, "accommodation", "SIGTUR_AlojamentosTuristicos", 2),
        Layer(Source.SIGTUR, "nature", "SIGTUR_TurismoNatureza", 9),
        Layer(Source.SIGTUR, "culture", "OpenData_AldeiasHistoricas", 1, "MapServer"),
        Layer(Source.SIGTUR, "beaches-golf", "OpenData_PraiasBA", 30, "MapServer", "Praia Bandeira Azul"),
        Layer(Source.SIGTUR, "beaches-golf", "SIGTUR_Golfe", 1, subcategory = "Golfe"),
        Layer(Source.SIGTUR, "wine-tourism", "SIGTUR_Light_Enoturismo", 1),
        Layer(Source.SIGTUR, "monuments", "Programa_REVIVE", 10),
        Layer(Source.ICNF, "protected-areas", "RNAP", 0),
        Layer(Source.ICNF, "natura-2000", "RN2000", 0, subcategory = "ZPE"),
        Layer(Source.ICNF, "natura-2000", "RN2000", 1, subcategory = "SIC"),
        Layer(Source.ICNF, "trails", "percursos_pedestres", 0),
    )

    val CATEGORY_LABELS = linkedMapOf(
        "unesco" to "Património Mundial UNESCO",
        "monuments" to "Monumentos",
        "culture" to "Aldeias Históricas",
        "beaches-golf" to "Praias e Golfe",
        "nature" to "Natureza",
        "protected-areas" to "Áreas Protegidas",
        "natura-2000" to "Rede Natura 2000",
        "trails" to "Percursos Pedestres",
        "wine-tourism" to "Enoturismo",
        "health-wellness" to "Saúde e Bem-Estar",
        "accommodation" to "Alojamento",
    )

    /** Pontos num raio de [radiusKm]. Layers que falhem são ignoradas; só lança erro se todas falharem. */
    suspend fun getPoints(lat: Double, lng: Double, radiusKm: Double): List<TourismPoint> = coroutineScope {
        val results = LAYERS.map { layer ->
            async { runCatching { queryLayer(layer, lat, lng, radiusKm) } }
        }.awaitAll()

        if (results.all { it.isFailure }) {
            throw results.first().exceptionOrNull()!!
        }

        results.flatMap { it.getOrDefault(emptyList()) } + unescoPoints(lat, lng, radiusKm)
    }

    private suspend fun queryLayer(layer: Layer, lat: Double, lng: Double, radiusKm: Double): List<TourismPoint> {
        val base = if (layer.source == Source.SIGTUR) SIGTUR_BASE else ICNF_BASE
        val url = "$base/${layer.service}/${layer.serverType}/${layer.layerId}/query".toHttpUrl().newBuilder()
            .addQueryParameter("where", "1=1")
            .addQueryParameter("outFields", "*")
            .addQueryParameter("returnGeometry", "true")
            .addQueryParameter("outSR", "4326")
            .addQueryParameter("f", "geojson")
            .addQueryParameter("resultRecordCount", "1000")
            .addQueryParameter("geometry", "$lng,$lat")
            .addQueryParameter("geometryType", "esriGeometryPoint")
            .addQueryParameter("inSR", "4326")
            .addQueryParameter("spatialRel", "esriSpatialRelIntersects")
            .addQueryParameter("distance", radiusKm.toString())
            .addQueryParameter("units", "esriSRUnit_Kilometer")
            .apply {
                // Polígonos/linhas do ICNF chegam a 400 KB; simplificados ficam com poucos KB e só
                // usamos o centro do bounding box.
                if (layer.source == Source.ICNF) {
                    addQueryParameter("maxAllowableOffset", "0.01")
                    addQueryParameter("geometryPrecision", "4")
                }
            }
            .build()

        val json = ApiClient.gson.fromJson(ApiClient.get(url.toString()), JsonObject::class.java)
        val features = json.getAsJsonArray("features") ?: return emptyList()
        return features.mapNotNull { element ->
            val feature = element.asJsonObject
            val geometry = feature.get("geometry")?.takeIf { it.isJsonObject }?.asJsonObject
                ?: return@mapNotNull null
            val props = feature.get("properties")?.takeIf { it.isJsonObject }?.asJsonObject ?: JsonObject()
            if (layer.source == Source.SIGTUR) sigturPoint(layer, geometry, props) else icnfPoint(layer, geometry, props)
        }
    }

    private fun sigturPoint(layer: Layer, geometry: JsonObject, props: JsonObject): TourismPoint? {
        if (geometry.get("type")?.asString != "Point") return null
        val coords = geometry.getAsJsonArray("coordinates") ?: return null
        val objectId = props.firstString("OBJECTID", "FID", "objectid").orEmpty()
        return TourismPoint(
            id = "sigtur:${layer.service}:${layer.layerId}:$objectId",
            name = props.firstString("Denominacao", "Denominação", "NOME", "DENOMINACAO", "DESIGNACAO", "QUINTA", "Name")
                ?: "Sem nome",
            category = layer.category,
            subcategory = layer.subcategory,
            municipality = props.firstString("Concelho", "CONCELHO", "MUNICIPIO"),
            address = props.firstString("Endereco", "MORADA", "ENDERECO", "Endereco_ent_gest"),
            latitude = coords[1].asDouble,
            longitude = coords[0].asDouble,
        )
    }

    private fun icnfPoint(layer: Layer, geometry: JsonObject, props: JsonObject): TourismPoint? {
        val center = boundingBoxCenter(geometry.get("coordinates") ?: return null) ?: return null
        val objectId = props.firstString("id", "OBJECTID", "FID").orEmpty()
        val areaHa = props.firstString("area_ha", "area__ha_")?.toDoubleOrNull()
        val lengthKm = props.firstString("compr_km")?.toDoubleOrNull()
        val detail = when {
            areaHa != null -> "Área: %,.0f ha".format(java.util.Locale.forLanguageTag("pt-PT"), areaHa)
            lengthKm != null -> "Percurso: %.1f km".format(java.util.Locale.forLanguageTag("pt-PT"), lengthKm)
            else -> null
        }
        return TourismPoint(
            id = "icnf:${layer.service}:${layer.layerId}:$objectId",
            name = props.firstString("nome_ap", "site_name", "nome") ?: "Sem nome",
            category = layer.category,
            subcategory = layer.subcategory ?: props.firstString("classifica", "tipo"),
            address = detail,
            latitude = center.first,
            longitude = center.second,
        )
    }

    /** Centro do bounding box de qualquer geometria GeoJSON (coordenadas [lng, lat] aninhadas). Devolve (lat, lng). */
    private fun boundingBoxCenter(coordinates: JsonElement): Pair<Double, Double>? {
        var minLng = Double.POSITIVE_INFINITY
        var minLat = Double.POSITIVE_INFINITY
        var maxLng = Double.NEGATIVE_INFINITY
        var maxLat = Double.NEGATIVE_INFINITY

        fun visit(element: JsonElement) {
            if (!element.isJsonArray) return
            val array: JsonArray = element.asJsonArray
            if (array.size() >= 2 && array[0].isJsonPrimitive) {
                val lng = array[0].asDouble
                val lat = array[1].asDouble
                minLng = minOf(minLng, lng); maxLng = maxOf(maxLng, lng)
                minLat = minOf(minLat, lat); maxLat = maxOf(maxLat, lat)
                return
            }
            array.forEach { visit(it) }
        }

        visit(coordinates)
        if (!minLng.isFinite() || !minLat.isFinite()) return null
        return Pair((minLat + maxLat) / 2, (minLng + maxLng) / 2)
    }

    private fun JsonObject.firstString(vararg keys: String): String? {
        for (key in keys) {
            val value = get(key) ?: continue
            if (value.isJsonNull) continue
            val text = if (value.isJsonPrimitive) value.asString else value.toString()
            if (text.isNotBlank()) return text.trim()
        }
        return null
    }

    private data class UnescoSite(val slug: String, val name: String, val municipality: String, val year: Int, val lat: Double, val lng: Double)

    // Mesma lista curada que packages/core/src/api/unesco.ts.
    private val UNESCO_SITES = listOf(
        UnescoSite("angra-do-heroismo", "Centro Histórico de Angra do Heroísmo", "Angra do Heroísmo", 1983, 38.6553, -27.2183),
        UnescoSite("mosteiro-jeronimos-torre-belem", "Mosteiro dos Jerónimos e Torre de Belém, Lisboa", "Lisboa", 1983, 38.6979, -9.2065),
        UnescoSite("convento-cristo-tomar", "Convento de Cristo, Tomar", "Tomar", 1983, 39.6031, -8.4103),
        UnescoSite("mosteiro-batalha", "Mosteiro da Batalha", "Batalha", 1983, 39.6608, -8.8258),
        UnescoSite("centro-historico-evora", "Centro Histórico de Évora", "Évora", 1986, 38.5714, -7.9086),
        UnescoSite("mosteiro-alcobaca", "Mosteiro de Alcobaça", "Alcobaça", 1989, 39.5522, -8.9803),
        UnescoSite("paisagem-cultural-sintra", "Paisagem Cultural de Sintra", "Sintra", 1995, 38.7876, -9.3904),
        UnescoSite("centro-historico-porto", "Centro Histórico do Porto, Ponte Dom Luís I e Mosteiro da Serra do Pilar", "Porto", 1996, 41.1409, -8.6118),
        UnescoSite("vale-do-coa", "Sítios de Arte Rupestre Pré-histórica do Vale do Côa", "Vila Nova de Foz Côa", 1998, 41.0722, -7.0392),
        UnescoSite("laurissilva-madeira", "Floresta Laurissilva da Madeira", "Madeira", 1999, 32.75, -17.0),
        UnescoSite("alto-douro-vinhateiro", "Alto Douro Vinhateiro", "Peso da Régua", 2001, 41.1621, -7.7864),
        UnescoSite("centro-historico-guimaraes", "Centro Histórico de Guimarães", "Guimarães", 2001, 41.4425, -8.2918),
        UnescoSite("paisagem-vinha-pico", "Paisagem da Cultura da Vinha da Ilha do Pico", "Ilha do Pico", 2004, 38.47, -28.34),
        UnescoSite("universidade-coimbra", "Universidade de Coimbra – Alta e Sofia", "Coimbra", 2013, 40.2083, -8.4257),
        UnescoSite("fronteira-elvas", "Fronteira de Elvas e suas Fortificações", "Elvas", 2012, 38.8817, -7.1614),
        UnescoSite("paco-real-mafra", "Paço Real de Mafra — Palácio, Basílica, Convento, Jardim do Cerco e Tapada", "Mafra", 2019, 38.9394, -9.3306),
        UnescoSite("bom-jesus-braga", "Santuário do Bom Jesus do Monte, Braga", "Braga", 2019, 41.5442, -8.3781),
    )

    private fun unescoPoints(lat: Double, lng: Double, radiusKm: Double): List<TourismPoint> =
        UNESCO_SITES
            .filter { LocationHelper.distanceKm(lat, lng, it.lat, it.lng) <= radiusKm }
            .map {
                TourismPoint(
                    id = "unesco:${it.slug}",
                    name = it.name,
                    category = "unesco",
                    subcategory = "Património Mundial (${it.year})",
                    municipality = it.municipality,
                    latitude = it.lat,
                    longitude = it.lng,
                )
            }
}

data class TourismPoint(
    val id: String,
    val name: String,
    val category: String,
    val subcategory: String? = null,
    val municipality: String? = null,
    val address: String? = null,
    val latitude: Double,
    val longitude: Double,
)
