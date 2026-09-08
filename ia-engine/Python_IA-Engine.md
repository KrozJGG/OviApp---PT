
El módulo encargado del procesamiento de imagen y deteccion con IA no necesita recibir peticiones desde el exterior, su trabajo es "observar y avisar".
* Se conecta al flujo de video mediante RTSP que emite MediaMTX para leer fotogramas.
* Actua como cliente HTTP → cuando el modelo YOLO detecta anomalía (ej: dispersion o conteo bajo), el script usara **requests** para enviar una alerta post a la API server de Express 

Para reducir el hardware (computo) se considera un código el cual reciba el video, descarte fotogramas y luego envie menor cantidad al modelo, es decir es mas facil procesar un video de 5 fotogramas que uno de 30 fps, ya que se considera que la transmisión se verá directamente por la web a través del protocolo HLS en MediaXMT y el server-ia solo se encargara de procesar imagenes necesarias para determinar la cantidad de ovejas, zona de interes usando trackZone para luego enviar alertas API server app el cual luego se lo hará llegar al cliente mediante el websocket.

* Libreria Pytorch habilitando CUDA para el procesamiento de modelos IA entrenamientos,etc.
* Libreria Ultralytics de donde obtendremos modelos previamente entrenados como YOLOv26
* OpenCV

