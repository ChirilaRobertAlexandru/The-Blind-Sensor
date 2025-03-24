from machine import Pin
from time import sleep

# Configurază pinul 25 ca ieșire
led = Pin(19, Pin.OUT)

while True:
    led.value(1)  # Aprinde LED-ul (setează pinul la HIGH)
    sleep(1)      # Așteaptă 1 secundă
    led.value(0)  # Stinge LED-ul (setează pinul la LOW)
    sleep(1)      # Așteaptă 1 secundă