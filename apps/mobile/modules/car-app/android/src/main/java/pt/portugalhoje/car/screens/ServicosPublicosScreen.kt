package pt.portugalhoje.car.screens

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.constraints.ConstraintManager
import androidx.car.app.model.Action
import androidx.car.app.model.CarLocation
import androidx.car.app.model.ItemList
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
import pt.portugalhoje.car.api.PublicService
import pt.portugalhoje.car.api.PublicServicesApi
import pt.portugalhoje.car.utils.LocationHelper
import pt.portugalhoje.car.utils.contentLimit
import pt.portugalhoje.car.utils.distanceText

/** Esquadras/postos de polícia (PSP, GNR, Municipal, Marítima) mais próximos — dados do WEB-023. */
class ServicosPublicosScreen(carContext: CarContext) : Screen(carContext) {
    private var requested = false
    private var loading = true
    private var services: List<ServiceWithDistance> = emptyList()
    private var errorMessage: String? = null

    override fun onGetTemplate(): Template {
        ensureLoaded()

        errorMessage?.let {
            return MessageTemplate.Builder(it)
                .setTitle(TITLE)
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (loading) {
            return PlaceListMapTemplate.Builder()
                .setTitle(TITLE)
                .setHeaderAction(Action.BACK)
                .setLoading(true)
                .build()
        }

        if (services.isEmpty()) {
            return MessageTemplate.Builder("Sem serviços públicos disponíveis.")
                .setTitle(TITLE)
                .setHeaderAction(Action.BACK)
                .build()
        }

        val itemList = ItemList.Builder().apply {
            services.forEach { (service, distanceKm) ->
                val place = Place.Builder(CarLocation.create(service.latitude, service.longitude)).build()
                val category = PublicServicesApi.CATEGORY_LABELS[service.category] ?: "Polícia"
                val where = listOfNotNull(service.address, service.locality ?: service.municipality)
                    .filter { it.isNotBlank() }
                    .distinct()
                    .joinToString(", ")
                addItem(
                    Row.Builder()
                        .setTitle(service.name)
                        .addText(distanceText(distanceKm, category))
                        .apply { if (where.isNotEmpty()) addText(where) }
                        .setMetadata(Metadata.Builder().setPlace(place).build())
                        .setOnClickListener {
                            screenManager.push(
                                PlaceDetailScreen(
                                    carContext,
                                    title = TITLE,
                                    name = service.name,
                                    latitude = service.latitude,
                                    longitude = service.longitude,
                                    distanceKm = distanceKm,
                                    detail = category,
                                    extraText = where,
                                ),
                            )
                        }
                        .build(),
                )
            }
        }.build()

        return PlaceListMapTemplate.Builder()
            .setTitle(TITLE)
            .setHeaderAction(Action.BACK)
            .setCurrentLocationEnabled(LocationHelper.hasPermission(carContext))
            .setItemList(itemList)
            .build()
    }

    private fun ensureLoaded() {
        if (requested) return
        requested = true
        val limit = contentLimit(carContext, ConstraintManager.CONTENT_LIMIT_TYPE_PLACE_LIST)
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val location = LocationHelper.getLocation(carContext)
                    val lat = location?.latitude ?: LISBON_LAT
                    val lng = location?.longitude ?: LISBON_LNG
                    PublicServicesApi.getAll(carContext)
                        .map { ServiceWithDistance(it, LocationHelper.distanceKm(lat, lng, it.latitude, it.longitude)) }
                        .sortedBy { it.distanceKm }
                        .take(limit)
                }
            }.onSuccess { result ->
                services = result
            }.onFailure { throwable ->
                errorMessage = throwable.message ?: "Não foi possível carregar os serviços públicos."
            }
            loading = false
            invalidate()
        }
    }

    private data class ServiceWithDistance(val service: PublicService, val distanceKm: Double)

    companion object {
        private const val TITLE = "Serviços Públicos"
        private const val LISBON_LAT = 38.72
        private const val LISBON_LNG = -9.14
    }
}
