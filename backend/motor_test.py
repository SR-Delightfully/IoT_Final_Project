# Standalone motor test - doesn't use mqttProj.py.
# Run it on the Pi with the backend stopped:  python motor_test.py
import RPi.GPIO as GPIO
import time

Motor1 = 22  # Enable pin
Motor2 = 27  # Input pin
Motor3 = 17  # Input pin
pins = [Motor1, Motor2, Motor3]

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
for p in pins:
    GPIO.setup(p, GPIO.OUT)

try:
    print("Motor ON for 5 seconds...")
    GPIO.output(Motor1, GPIO.HIGH)
    GPIO.output(Motor2, GPIO.LOW)
    GPIO.output(Motor3, GPIO.HIGH)
    print("Pins set:", ", ".join(f"GPIO{p}={GPIO.input(p)}" for p in pins))
    time.sleep(5)
finally:
    for p in pins:
        GPIO.output(p, GPIO.LOW)
    GPIO.cleanup(pins)
    print("Motor OFF")