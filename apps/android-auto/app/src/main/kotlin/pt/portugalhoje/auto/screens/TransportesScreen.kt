package pt.portugalhoje.auto.screens

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pt.portugalhoje.auto.api.ComboiosApi
import pt.portugalhoje.auto.api.TrainVehicle

class TransportesScreen(carContext: CarContext) : Screen(carContext) {
    private var requested = false
    private var loading = true
    private var trains: List<TrainVehicle> = emptyList()
    private var errorMessage: String? = null

    override fun onGetTemplate(): Template {
        ensureLoaded()

        errorMessage?.let {
            return MessageTemplate.Builder(it)
                .setTitle("Transportes CP")
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (loading) {
            return ListTemplate.Builder()
                .setTitle("Transportes CP")
                .setHeaderAction(Action.BACK)
                .setLoading(true)
                .build()
        }

        if (trains.isEmpty()) {
            return MessageTemplate.Builder("Sem comboios disponíveis.")
                .setTitle("Transportes CP")
                .setHeaderAction(Action.BACK)
                .build()
        }

        val itemList = ItemList.Builder().apply {
            trains.take(6).forEach { train: TrainVehicle ->
                val delayMin = train.delay / 60
                val delayText = if (delayMin <= 0) "Pontual" else "+${delayMin} min"
                addItem(
                    Row.Builder()
                        .setTitle("${train.trainNumber} · ${train.origin.designation} → ${train.destination.designation}")
                        .addText("${train.service.designation} · $delayText")
                        .build(),
                )
            }
        }.build()

        return ListTemplate.Builder()
            .setTitle("Comboios CP")
            .setHeaderAction(Action.BACK)
            .setSingleList(itemList)
            .build()
    }

    private fun ensureLoaded() {
        if (requested) return
        requested = true
        lifecycleScope.launch {
            loading = true
            errorMessage = null
            runCatching {
                withContext(Dispatchers.IO) { ComboiosApi.getVehicles() }
            }.onSuccess { result ->
                trains = result.sortedByDescending { v: TrainVehicle -> v.delay }
                loading = false
            }.onFailure { throwable ->
                errorMessage = throwable.message ?: "Não foi possível carregar os comboios."
                loading = false
            }
            invalidate()
        }
    }
}
