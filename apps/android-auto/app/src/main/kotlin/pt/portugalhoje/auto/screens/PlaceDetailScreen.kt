package pt.portugalhoje.auto.screens

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarColor
import androidx.car.app.model.CarLocation
import androidx.car.app.model.ItemList
import androidx.car.app.model.Metadata
import androidx.car.app.model.Place
import androidx.car.app.model.PlaceListMapTemplate
import androidx.car.app.model.PlaceMarker
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import pt.portugalhoje.auto.utils.LocationHelper
import pt.portugalhoje.auto.utils.distanceText
import pt.portugalhoje.auto.utils.navigateTo

/**
 * Detalhe de um local escolhido numa lista com mapa: o mapa fica centrado só nesse ponto
 * e "Navegar" pede à app de navegação a rota desde a posição atual.
 */
class PlaceDetailScreen(
    carContext: CarContext,
    private val title: String,
    private val name: String,
    private val latitude: Double,
    private val longitude: Double,
    private val distanceKm: Double,
    private val detail: String,
    private val extraText: String? = null,
) : Screen(carContext) {
    override fun onGetTemplate(): Template {
        val place = Place.Builder(CarLocation.create(latitude, longitude))
            .setMarker(PlaceMarker.Builder().setColor(CarColor.BLUE).build())
            .build()

        val row = Row.Builder()
            .setTitle(name)
            .addText(distanceText(distanceKm, detail))
            .apply { extraText?.takeIf { it.isNotBlank() }?.let { addText(it) } }
            .setMetadata(Metadata.Builder().setPlace(place).build())
            .build()

        val navigate = Action.Builder()
            .setTitle("Navegar")
            .setOnClickListener { navigateTo(carContext, latitude, longitude) }
            .build()

        return PlaceListMapTemplate.Builder()
            .setTitle(title)
            .setHeaderAction(Action.BACK)
            .setCurrentLocationEnabled(LocationHelper.hasPermission(carContext))
            .setItemList(ItemList.Builder().addItem(row).build())
            .setActionStrip(ActionStrip.Builder().addAction(navigate).build())
            .build()
    }
}
