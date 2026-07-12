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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pt.portugalhoje.auto.api.AnpcApi
import pt.portugalhoje.auto.api.AnpcIncident

class ProtecaoCivilScreen(carContext: CarContext) : Screen(carContext) {
    private val apiScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var requested = false
    private var loading = true
    private var incidents: List<AnpcIncident> = emptyList()
    private var errorMessage: String? = null

    override fun onGetTemplate(): Template {
        ensureLoaded()

        errorMessage?.let {
            return MessageTemplate.Builder(it)
                .setTitle("Proteção Civil")
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (loading) {
            return ListTemplate.Builder()
                .setTitle("Proteção Civil")
                .setHeaderAction(Action.BACK)
                .setLoading(true)
                .build()
        }

        if (incidents.isEmpty()) {
            return MessageTemplate.Builder("Sem ocorrências disponíveis.")
                .setTitle("Proteção Civil")
                .setHeaderAction(Action.BACK)
                .build()
        }

        val itemList = ItemList.Builder().apply {
            incidents.forEach { incident ->
                addItem(
                    Row.Builder()
                        .setTitle("${incident.type} — ${incident.status}")
                        .addText(incident.location.address.ifBlank { incident.location.district })
                        .build(),
                )
            }
        }.build()

        return ListTemplate.Builder()
            .setTitle("Proteção Civil")
            .setHeaderAction(Action.BACK)
            .setSingleList(itemList)
            .build()
    }

    override fun onDestroy() {
        apiScope.cancel()
        super.onDestroy()
    }

    private fun ensureLoaded() {
        if (requested) {
            return
        }
        requested = true
        lifecycleScope.launch {
            loading = true
            errorMessage = null
            runCatching {
                withContext(apiScope.coroutineContext) {
                    AnpcApi.getIncidents()
                }
            }.onSuccess { result ->
                incidents = result
                loading = false
            }.onFailure { throwable ->
                errorMessage = throwable.message ?: "Não foi possível carregar as ocorrências."
                loading = false
            }
            invalidate()
        }
    }
}
