package pt.portugalhoje.auto

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session
import pt.portugalhoje.auto.screens.MainMenuScreen

class PortugalHojeSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen = MainMenuScreen(carContext)
}
