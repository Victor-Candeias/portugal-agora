package pt.portugalhoje.car

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session
import pt.portugalhoje.car.screens.MainMenuScreen

class PortugalHojeSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen = MainMenuScreen(carContext)
}
