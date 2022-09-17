/*
    Douban Movie Add-ons for Quantumult X by Neurogram

        - 豆瓣电影移动版网页增强
        - 快捷跳转 茶杯狐 搜索
        - 展示在映流媒体平台
        - 快捷收藏电影至 Airtable

    使用说明

        [rewrite_local]
        // 茶杯狐、流媒体
        ^https://m.douban.com/movie/subject/.+ url script-response-body Douban.js

        // Airtable 收藏
        ^https://m.douban.com/movie/subject/.+\?seen=\d url script-request-header Douban.js

        [mitm]
        hostname = m.douban.com

        收藏功能，需自行修改代码，点击 想看 / 看过 触发收藏
   
    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/
const $ = new Env('Douban')
$.PROVIDERS_KEY = 'Neurogram_DouBan_provider'
$.providers = JSON.parse($.getdata($.PROVIDERS_KEY) || [])
let url = $request.url
let movieId = url.match(/subject\/(\d+)/)
let seen = url.match(/\?seen=(\d)$/)
let collect = true  //收藏功能，默认关闭，需自行配置
let region = "US" //流媒体区域
let tmdb_api_key = "55dcc15aae83ec3b9e03b76ff5b03656" // TMDB API KEY

if (!seen) douban_addons()
if (seen) collect_movie()

async function douban_addons() {
    let body = $response.body
    let title = body.match(/"sub-title">([^<]+)/)
    if (!title) $done({})
    if (collect) body = body.replace(/<a.+pbtn.+wish.+>/, `<a href="${url}?seen=0">`)
    if (collect) body = body.replace(/<a.+pbtn.+collect.+>/, `<a href="${url}?seen=1">`)
	$.setdata(JSON.stringify([]), $.PROVIDERS_KEY)

    let mweb = [`<a href="https://www.cupfox.com/search?key=${title[1]}"><img src="https://files.catbox.moe/c8vszl.png" height="25" width="34.78" style="vertical-align: text-top;" /></a>`]
    let douban_options = {
        url: `https://frodo.douban.com/api/v2/movie/${movieId[1]}?apiKey=0ac44ae016490db2204ce0a042db2916`,
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.3(0x18000323) NetType/WIFI Language/en",
            "Referer": "https://servicewechat.com/wx2f9b06c1de1ccfca/82/page-frame.html"
        }
    }

    let douban_result = await send_request(douban_options)

    if ((douban_result.type == "movie" || douban_result.type == "tv") && douban_result.original_title && tmdb_api_key) {

        let tbdb_query_options = {
            url: `https://api.themoviedb.org/3/search/${douban_result.type}?api_key=${tmdb_api_key}&query=${encodeURIComponent(douban_result.original_title.replace(/Season \d+$/, ""))}&page=1`,
            method: "GET"
        }
        let tmdb_query = await send_request(tbdb_query_options)

        if (tmdb_query.results[0]) {

            let providers_query_options = {
                url: `https://api.themoviedb.org/3/${douban_result.type}/${tmdb_query.results[0].id}/watch/providers?api_key=${tmdb_api_key}`,
                method: "GET"
            }

            let tmdb_providers = await send_request(providers_query_options)

            if (tmdb_providers.results[region]) {
                if (tmdb_providers.results[region].flatrate) {
                    for (var i in tmdb_providers.results[region].flatrate) {
                        mweb.push(`<a href=""><img src="https://image.tmdb.org/t/p/original${tmdb_providers.results[region].flatrate[i].logo_path}" height="25" width="25" style="vertical-align: text-top;" /></a>`)
						var provider = {
							"width": 25,
							"height": 25,
							"url": "https://image.tmdb.org/t/p/original/"+tmdb_providers.results[region].flatrate[i].logo_path,
						}		
						providers.push(provider)
                    }
					$.setdata(JSON.stringify(providers), $.PROVIDERS_KEY)
					//$.providers = JSON.stringify(providers)
					//console.log(JSON.stringify(providers));
					//$notify('收藏失败', airtable_collect.error.type, airtable_collect.error.message);
                }
            }

        }

    }

    body = body.replace(/("sub-title">.+?)(<\/div>)/, `$1${mweb.join("\n")}$2`)

    $done({ body })

}

async function collect_movie() {
    if ($response) $done({})
    let options = {
        url: `https://frodo.douban.com/api/v2/movie/${movieId[1]}?apiKey=0ac44ae016490db2204ce0a042db2916`,
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.3(0x18000323) NetType/WIFI Language/en",
            "Referer": "https://servicewechat.com/wx2f9b06c1de1ccfca/82/page-frame.html"
        }
    }

    let douban_result = await send_request(options)

    if (douban_result.msg == "movie_not_found") {
        $notify('豆瓣电影', data.msg, "");
        $done({ path: url.replace(/https:\/\/m.douban.com|\/\?seen=\d/g, "") })
    }

    let casts = ""
    for (var i = 0; i < douban_result.actors.length; i++) {
        casts = casts + douban_result.actors[i].name + " / "
    }
    let directors = ""
    for (var k = 0; k < douban_result.directors.length; k++) {
        directors = directors + douban_result.directors[k].name + " / "
    }
    let title = douban_result.title + "  " + douban_result.original_title
	//console.log(JSON.stringify(providers)); 
	
    let table = {
        url: "https://api.airtable.com/v0/appUy2QeCdkMGnKY1/Douban",
        method: "POST",
        headers: {
            Authorization: "Bearer key9wUh99ucoMFxfr",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            records: [
                {
                    "fields": {
                        "Title": title,
                        "Description": douban_result.intro,
                        "Poster": [
                            {
                                "url": douban_result.pic.large
                            }
                        ],
                        "Seen": seen[1] == 1 ? true : false,
						"Provider": [
							{
							"url": "https://image.tmdb.org/t/p/original/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg",
							}
						],
                        "Actors": casts.replace(/\s\/\s$/, ""),
                        "Director": directors.replace(/\s\/\s$/, ""),
                        "Genre": douban_result.genres.toString(),
                        "Douban": "https://movie.douban.com/subject/" + movieId[1],
                        "Rating": douban_result.rating.value,
                        "Year": douban_result.year
                    }
                }
            ]
        })
    }
	//providers = []
    let airtable_collect = await send_request(table)

    if (!airtable_collect.records) {
        $notify('收藏失败', airtable_collect.error.type, airtable_collect.error.message);
        $done({ path: url.replace(/https:\/\/m.douban.com|\/\?seen=\d/g, "") })
    }

    $notify('豆瓣电影', title + " 收藏成功", "");
    $done({ path: url.replace(/https:\/\/m.douban.com|\/\?seen=\d/g, "") })
}

function send_request(options) {
    return new Promise((resolve, reject) => {
        $task.fetch(options).then(response => {
            resolve(JSON.parse(response.body))
        })
    })
}



/***************** Env *****************/
// prettier-ignore
// https://github.com/chavyleung/scripts/blob/master/Env.min.js
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http://${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){if(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:i,statusCode:r,headers:o,rawBody:h}=t;e(null,{status:i,statusCode:r,headers:o,rawBody:h},s.decode(h,this.encoding))},t=>{const{message:i,response:r}=t;e(i,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&delete t.headers["Content-Length"],this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){let i=require("iconv-lite");this.initGotEnv(t);const{url:r,...o}=t;this.got[s](r,o).then(t=>{const{statusCode:s,statusCode:r,headers:o,rawBody:h}=t;e(null,{status:s,statusCode:r,headers:o,rawBody:h},i.decode(h,this.encoding))},t=>{const{message:s,response:r}=t;e(s,r,r&&i.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,i=rawOpts["update-pasteboard"]||rawOpts.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":i}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`❗️${this.name}, 错误!`,t.stack):this.log("",`❗️${this.name}, 错误!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)}
