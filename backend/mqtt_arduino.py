import paho.mqtt.subscribe as subscribe
import time

while True:
    msgtemp = subscribe.simple("esp32/temperature", hostname="192.168.0.163") #"IoTlab/EPS32"
    msghum = subscribe.simple("esp32/humidity", hostname="192.168.0.163") #"IoTlab/EPS32"
    time.sleep(1)
    print("%s %s" % (msgtemp.topic, msgtemp.payload))
    print("%s %s" % (msghum.topic, msghum.payload))
