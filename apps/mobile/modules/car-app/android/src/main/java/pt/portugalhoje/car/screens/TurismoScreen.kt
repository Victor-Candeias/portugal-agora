package pt.portugalhoje.car.screens

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.constraints.ConstraintManager
import androidx.car.app.model.Action
import androidx.car.app.model.CarLocation
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Metadata
import androidx.car.app.model.Place
import androidx.car.app.model.PlaceListMapTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pt.portugalhoje.car.api.TourismApi
import pt.portugalhoje.car.api.TourismPoint
import pt.portugalhoje.car.utils.LocationHelper
import pt.portugalhoje.car.utils.contentLimit
import pt.portugalhoje.car.utils.distanceText
import java.util.Locale

private const val TURISMO_TITLE = "Turismo"

data class TourismPointWithDistance(val point: TourismPoint, val distanceKm: Double)

/** Categorias com pontos de interesse num raio de 25 km (SIGTUR · ICNF · UNESCO), como no mobile. */
class TurismoScreen(carContext: CarContext) : Screen(carContext) {
    private var requested = false
    private var loading = true
    private var usingFallback = false
    private var byCategory: Map<String, List<TourismPointWithDistance>> = emptyMap()
    private var errorMessage: String? = null

    override fun onGetTemplate(): Template {
        ensureLoaded()

        errorMessage?.let {
            return MessageTemplate.Builder(it)
                .setTitle(TURISMO_TITLE)
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (loading) {
            return ListTemplate.Builder()
                .setTitle(TURISMO_TITLE)
                .setHeaderAction(Action.BACK)
                .setLoading(true)
                .build()
        }

        if (byCategory.isEmpty()) {
            return MessageTemplate.Builder("Sem pontos de interesse num raio de $RADIUS_KM km.")
                .setTitle(TURISMO_TITLE)
                .setHeaderAction(Action.BACK)
                .build()
        }

        val itemList = ItemList.Builder().apply {
            byCategory.entries.take(contentLimit(carContext)).forEach { (category, points) ->
                val label = TourismApi.CATEGORY_LABELS[category] ?: category
                val nearestKm = String.format(Locale.forLanguageTag("pt-PT"), "%.1f", points.first().distanceKm)
                addItem(
                    Row.Builder()
                        .setTitle(label)
                        .addText("${points.size} ${if (points.size == 1) "local" else "locais"} · mais próximo a $nearestKm km")
                        .setBrowsable(true)
                        .setOnClickListener {
                            screenManager.push(TurismoCategoriaScreen(carContext, label, points))
                        }
                        .build(),
                )
            }
        }.build()

        val where = if (usingFallback) "perto de Lisboa" else "perto de ti"
        return ListTemplate.Builder()
            .setTitle("$TURISMO_TITLE · $RADIUS_KM km $where")
            .setHeaderAction(Action.BACK)
            .setSingleList(itemList)
            .build()
    }

    private fun ensureLoaded() {
        if (requested) return
        requested = true
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val location = LocationHelper.getLocation(carContext)
                    val lat = location?.latitude ?: LISBON_LAT
                    val lng = location?.longitude ?: LISBON_LNG
                    val points = TourismApi.getPoints(lat, lng, RADIUS_KM.toDouble())
                        .map { TourismPointWithDistance(it, LocationHelper.distanceKm(lat, lng, it.latitude, it.longitude)) }
                        .sortedBy { it.distanceKm }
                    val grouped = points.groupBy { it.point.category }
                    // Ordem fixa das categorias (TourismApi.CATEGORY_LABELS); desconhecidas no fim.
                    val ordered = TourismApi.CATEGORY_LABELS.keys.filter { it in grouped } + (grouped.keys - TourismApi.CATEGORY_LABELS.keys)
                    Pair(location == null, ordered.associateWith { grouped.getValue(it) })
                }
            }.onSuccess { (fallback, result) ->
                usingFallback = fallback
                byCategory = result
            }.onFailure { throwable ->
                errorMessage = throwable.message ?: "Não foi possível carregar os pontos de interesse."
            }
            loading = false
            invalidate()
        }
    }

    companion object {
        private const val RADIUS_KM = 25
        private const val LISBON_LAT = 38.716
        private const val LISBON_LNG = -9.139
    }
}

class TurismoCategoriaScreen(
    carContext: CarContext,
    private val title: String,
    private val points: List<TourismPointWithDistance>,
) : Screen(carContext) {
    override fun onGetTemplate(): Template {
        val limit = contentLimit(carContext, ConstraintManager.CONTENT_LIMIT_TYPE_PLACE_LIST)
        val itemList = ItemList.Builder().apply {
            points.take(limit).forEach { (point, distanceKm) ->
                val place = Place.Builder(CarLocation.create(point.latitude, point.longitude)).build()
                val detail = listOfNotNull(point.subcategory, point.municipality).joinToString(" · ").ifBlank { title }
                addItem(
                    Row.Builder()
                        .setTitle(point.name)
                        .addText(distanceText(distanceKm, detail))
                        .apply { point.address?.let { addText(it) } }
                        .setMetadata(Metadata.Builder().setPlace(place).build())
                        .setOnClickListener {
                            screenManager.push(
                                PlaceDetailScreen(
                                    carContext,
                                    title = title,
                                    name = point.name,
                                    latitude = point.latitude,
                                    longitude = point.longitude,
                                    distanceKm = distanceKm,
                                    detail = detail,
                                    extraText = point.address,
                                ),
                            )
                        }
                        .build(),
                )
            }
        }.build()

        return PlaceListMapTemplate.Builder()
            .setTitle(title)
            .setHeaderAction(Action.BACK)
            .setCurrentLocationEnabled(LocationHelper.hasPermission(carContext))
            .setItemList(itemList)
            .build()
    }
}
