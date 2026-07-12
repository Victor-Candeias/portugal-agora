package pt.portugalhoje.auto.screens

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template

class MainMenuScreen(carContext: CarContext) : Screen(carContext) {
    override fun onGetTemplate(): Template {
        val itemList = ItemList.Builder()
            .addItem(menuRow("🔥 Proteção Civil") { screenManager.push(ProtecaoCivilScreen(carContext)) })
            .addItem(menuRow("⛽ Combustível") { screenManager.push(CombustivelScreen(carContext)) })
            .addItem(menuRow("🏥 Hospitais SNS") { screenManager.push(HospitaisScreen(carContext)) })
            .addItem(menuRow("🌤️ Tempo") { screenManager.push(TempoScreen(carContext)) })
            .addItem(menuRow("🚆 Transportes CP") { screenManager.push(TransportesScreen(carContext)) })
            .build()

        return ListTemplate.Builder()
            .setTitle("Portugal Hoje")
            .setHeaderAction(Action.APP_ICON)
            .setSingleList(itemList)
            .build()
    }

    private fun menuRow(title: String, onClick: () -> Unit): Row =
        Row.Builder()
            .setTitle(title)
            .setBrowsable(true)
            .setOnClickListener(onClick)
            .build()
}
