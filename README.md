# TubeX
A forward proxy to YouTube written in nodejs based on videojs, koa, axios, ytsr and ytdl-core.

## Intoduction
By deploying this tiny forward proxy on your VPS as a website, you can:
* search and watch youtube videos without reverse proxy;
* watch youtube videos online without ads;
* watch youtube videos with accelerated play rates;
* watch/download youtube videos in different qualities (360p/720p).

## Usage
Install TubeX by npm:
* npm i tubex
* cd ~/node_modules/tubex

Put your app.key and app.crt in this folder, or create a self-signed certificate with openssl:
* openssl req -x509 -sha256 -nodes -days 3650 -newkey rsa:2048 -keyout app.key -out app.crt

Then start server in background:
* sudo nohup ./server.js >> tubex.log 2>&1 &

Now you can access your website in browsers.

## Screenshots
### Search results
![image](https://github.com/dreamrover/screenshots/blob/master/TED.png)
### Watch online
![image](https://github.com/dreamrover/screenshots/blob/master/Shara.png)
