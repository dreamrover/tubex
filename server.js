#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Koa = require('koa');
const Router = require('koa-router');
const sslify = require('koa-sslify').default;
const ytsr = require('ytsr');
const ytdl = require('ytdl-core');
const http = require('http');
const https = require('https');
const axios = require('axios');
const PassThrough = require('stream').PassThrough;
require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');

const favicon = "https://img.icons8.com/color/48/000000/rotube.png";

const create_head = (title) => `
  <head>
    <title>TubeX${title ? ' - ' + title : ''}</title>
    <link rel="shortcut icon" href=${favicon} type="image/x-icon" />
    <style>
      table, th, td {
        font-family: arial, sans-serif;
        border: 1px solid #cccccc;
        border-collapse: collapse;
      }
      th {
        padding: 5px;
        text-align: center;
      }
      td {
        padding: 5px;
        text-align:left;
      }
    </style>
  </head>
`;

function create_table(arr, caption) {
  if (!arr || !arr.length) return '';
  var first = '', rows = [];
  Object.keys(arr[0]).forEach(e => first += `<th>${e}</th>`);
  rows.push(`<tr>${first}</tr>`);
  arr.forEach(r => {
    let line = '';
    Object.values(r).forEach(e => line += `<td>${e || ''}</td>`);
    rows.push(`<tr>${line}</tr>`);
  });
  return `<table style="word-wrap:break-word">
        ${caption ? `<caption><h4>${caption}</h4></caption>` : ''}
        ${rows.join('\n        ')}
      </table><br>`;
}

const create_page = (title, keyword, extra) => `
<html>
  ${create_head(title)}
  <h1 style="text-align:center;">TubeX</h1>
  <body>
    <form action="/result" method="get" style="text-align:center;">
      <p><input type="text" size=30 name="search_query" value="${keyword||''}"><input type="submit" value="Go"></p>
      <p><input type="radio" id="radio1" name="t" value="kw" checked><label for="radio1">keyword</label>
      <input type="radio" id="radio2" name="t" value="id"><label for="radio2">url/id</label></p>
    </form>
    ${extra || ''}
  </body>
</html>
`;

function create_result_content(result) {
  var arr = [];
  result.items.forEach(e => arr.push({
    thumbnail: `<img width="180" height="101" src="${e.thumbnail}" />`,
    detail: `<p><a href="./watch?v=${e.id}"><h4>${e.title}</h4></a></p><p>${e.type}&emsp;<b>${e.duration}</b>&emsp;${e.views.toLocaleString()} views&emsp;${e.uploadedAt}&emsp;@<b>${e.author.name}</b></p><p>${e.description || ''}</p>`
  }));
  return `<center>
      <h3>${result.original}:</h3>
      <p>${result.results.toLocaleString()} results</p>
      ${create_table(arr)}
    </center>`;
}

function create_video_source(video) {
  if (!video || !video.formats || !video.formats.length) return '';
  var arr = [];
  video.formats.forEach((e, i) => arr.push(`${i ? '        ':''}<source src="./${encode_url(e.url)}/${video.title.replaceAll(/[\\/:*?"<>|]/g, '')}.${e.container}" type='${e.mimeType}' label="${e.qualityLabel}"${i ? '':' selected="true"'}>`));
  return arr.join('\n');
}

function create_watch_content(video) {
  var downloads = [];
  video.formats.forEach(e => downloads.push({
    format: e.container,
    quality: e.qualityLabel,
    size: e.contentLength ? parseInt(e.contentLength).toLocaleString() : 'unknown',
    get: `<a href="./${encode_url(e.url)}/${video.title.replaceAll(/[\\/:*?"<>|]/g, '')}.${e.container}" download>download</a>`,
    url: `<input name="url" readonly="readonly" value="${e.url}">`
  }));
  var relates = [];
  video.related.forEach(e => relates.push({
    thumbnail: `<img width="168" height="94" src="${e.thumbnail}" />`,
    detail: `<a href="./watch?v=${e.id}"><h4>${e.title}</h4></a><p><b>${sec_to_str(e.duration)}</b>&emsp;${e.views.toLocaleString()} views&emsp;${e.published}&emsp;@<b>${e.author.name}</b></p>`
  }));
  return `
    <style>
      .video-js {
        width: ${video.formats[0].width}px;
        height: ${video.formats[0].height}px;
      }
    </style>
    <link href="https://vjs.zencdn.net/7.11.4/video-js.css" rel="stylesheet">
    <link href="https://unpkg.com/@silvermine/videojs-quality-selector/dist/css/quality-selector.css" rel="stylesheet">
    <link href="https://7ds7.github.io/videojs-vjsdownload/dist/videojs-vjsdownload.css" rel="stylesheet">
    <center>
      <video id="videojs-player" class="video-js" controls preload="auto" width="${video.formats[0].width}" height="${video.formats[0].height}" poster="${video.poster}">
        ${create_video_source(video)}
      </video>
      <p><h4>${video.title}</h4></p>
      <p><b>${sec_to_str(video.duration)}</b>&emsp;${video.views.toLocaleString()} views&emsp;${video.date}&emsp;@<b>${video.author.name}</b></p>
      <p align="left" style="width:${video.formats[0].width-20}px"><font size="-1">${video.description ? video.description.replaceAll('\n', '<br>') : ''}</font></p>
      ${create_table(downloads)}
      ${create_table(relates, 'related videos')}
    </center>
    <script src="https://vjs.zencdn.net/7.11.4/video.min.js"></script>
    <script src="https://videojs.github.io/videojs-playbackrate-adjuster/dist/browser/videojs-playbackrate-adjuster.js"></script>
    <script src="https://unpkg.com/@silvermine/videojs-quality-selector/dist/js/silvermine-videojs-quality-selector.min.js"></script>
    <script src="https://7ds7.github.io/videojs-vjsdownload/dist/videojs-vjsdownload.js"></script>
    <script>
      var player = videojs('videojs-player', {playbackRates: [1, 1.25, 1.5, 2]});
      player.controlBar.addChild('qualitySelector');
      player.vjsdownload();
    </script>`;
}

const encode_url = (url) => zlib.deflateSync(Buffer.from(url)).toString('base64').replaceAll('/', '-').replaceAll('+', '_');

const decode_url = (str) => zlib.inflateSync(Buffer.from(str.replaceAll('-', '/').replaceAll('_', '+'), 'base64')).toString();

const sec_to_str = (sec) => {
  if (isNaN(sec)) return null;
  if (sec < 10) return '0:0' + sec;
  if (sec < 60) return '0:' + sec;
  if (sec < 3600) return Math.floor(sec/60).toString() + ':' + (sec%60 < 10 ? '0'+sec%60 : sec%60);
  return Math.floor(sec/3600).toString() + ':' + (sec%3600 < 600 ? '0'+sec_to_str(sec%3600) : sec_to_str(sec%3600));
}

const router = new Router();

router.get('/', async (ctx, next) => {
  ctx.response.body = create_page();
});

router.get('/result', async (ctx, next) => {
  const keyword = ctx.request.query['search_query'];
  if (!keyword) {
    ctx.redirect('./');
    return;
  }
  const t = ctx.request.query['t'];
  if (t == 'id') {
    ctx.redirect(`./watch?v=${keyword}`);
    return;
  }
  console.log(JSON.stringify(ctx.request.query));
  const res = await ytsr(keyword);
  var result = {
    original: res.originalQuery,
    corrected: res.correctedQuery,
    results: res.results,
    items: []
  };
  res.items.filter(item => item.type == 'video').forEach(e => result.items.push({
    thumbnail: `./thumbnail?url=${encode_url(e.thumbnails.pop().url)}&encoded=1`,
    id: e.id,
    title: e.title,
    type: e.type,
    duration: e.duration,
    views: e.views,
    uploadedAt: e.uploadedAt,
    author: e.author,
    description: e.description
  }));
  ctx.response.body = create_page(keyword, keyword, create_result_content(result));
});

router.get('/watch', async (ctx, next) => {
  console.log(JSON.stringify(ctx.request.query));
  const id = ctx.request.query['v'];
  if (!id) {
    ctx.redirect('./');
    return;
  }
  const info = await ytdl.getInfo(id);
  var video = {
    title: info.videoDetails.title,
    poster: `./thumbnail?url=${info.videoDetails.thumbnails[0].url}`,
    duration: parseInt(info.videoDetails.lengthSeconds),
    views: parseInt(info.videoDetails.viewCount),
    date: info.videoDetails.publishDate,
    author: info.videoDetails.author,
    description: info.videoDetails.description,
    formats: info.formats.filter(e => e.hasVideo && e.hasAudio),
    related: []
  };
  info.related_videos.forEach(e => video.related.push({
    thumbnail: `./thumbnail?url=${encode_url(e.thumbnails[0].url)}&encoded=1`,
    id: e.id,
    title: e.title,
    duration: e.length_seconds,
    views: parseInt(e.view_count),
    published: e.published,
    author: e.author
  }));
  console.log(video.title);
  ctx.response.body = create_page(video.title, null, create_watch_content(video));
});

router.get('/thumbnail', async (ctx, next) => {
  const url = ctx.request.query.encoded ? decode_url(ctx.request.query.url) : ctx.request.query.url;
  const res = await axios.request({method: 'get', url: url, responseType: 'stream'});
  ctx.response.status = res.status;
  ctx.response.set(res.headers);
  ctx.response.body = res.data.pipe(PassThrough());
});

router.get('/:url/:name', async (ctx, next) => {
  const url = decode_url(ctx.params.url);
  var config = {method: 'get', url: url, responseType: 'stream'};
  if (ctx.request.header.range) config.headers = {range: ctx.request.header.range};
  var res = await axios.request(config);
  ctx.response.status = res.status;
  ctx.response.set(res.headers);
  ctx.response.body = res.data.pipe(PassThrough());
});

process.chdir(path.dirname(process.argv[1]));

const server = new Koa();
http.createServer(server.callback()).listen(80);
server.use(sslify());
server.use(router.routes());
const options = {
    key: fs.readFileSync('./app.key'),
    cert: fs.readFileSync('./app.crt')
};
https.createServer(options, server.callback()).listen(443);
//server.listen(8000);
console.log('server started');
