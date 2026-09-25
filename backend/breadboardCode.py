import RPi.GPIO as GPIO
from time import sleep

def login(attempt=False):
    ledpin = 26 # PWM pin connected to BLUE LED
    buzzpin = 21 # PWM pin connected to buzzer AND RED LED
    GPIO.setwarnings(False) #disable warnings
    GPIO.setmode(GPIO.BCM) #set pin numbering system
    GPIO.setup(ledpin,GPIO.OUT)
    GPIO.setup(buzzpin,GPIO.OUT)
    led_pwm = GPIO.PWM(ledpin,1000) #create PWM instance with frequency
    buzz_pwm = GPIO.PWM(buzzpin,1000)
    led_pwm.start(0) #start PWM of required Duty Cycle
    buzz_pwm.start(0)
    if(attempt): #needs condition depending on the user connection is success (true) or fail (false)
        for duty in range(0,101,1):
            led_pwm.ChangeDutyCycle(duty) #provide duty cycle in the range 0-100
            sleep(0.01)
        sleep(0.5)
    
        for duty in range(100,-1,-1):
            led_pwm.ChangeDutyCycle(duty)
            sleep(0.01)
        sleep(0.5)
    else:
        for duty in range(0,101,1):
            buzz_pwm.ChangeDutyCycle(duty) #provide duty cycle in the range 0-100
            sleep(0.01)
        sleep(0.5)
    
        for duty in range(100,-1,-1):
            buzz_pwm.ChangeDutyCycle(duty)
            sleep(0.01)
        sleep(0.5)
        
#login() #Uncomment for testing and pass True or False as a parameter