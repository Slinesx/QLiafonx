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
$.providers = JSON.prase($.getData($.PROVIDERS_KEY) || [])
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
	$.setData(JSON.stringify([]), $.PROVIDERS_KEY)

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
					$.setData(JSON.stringify(providers), $.PROVIDERS_KEY)
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

function Env(name, opts) {
  class Http {
    constructor(env) {
      this.env = env
    }

    send(opts, method = 'GET') {
      opts = typeof opts === 'string' ? { url: opts } : opts
      let sender = this.get
      if (method === 'POST') {
        sender = this.post
      }
      return new Promise((resolve, reject) => {
        sender.call(this, opts, (err, resp, body) => {
          if (err) reject(err)
          else resolve(resp)
        })
      })
    }

    get(opts) {
      return this.send.call(this.env, opts)
    }

    post(opts) {
      return this.send.call(this.env, opts, 'POST')
    }
  }

  return new (class {
    constructor(name, opts) {
      this.name = name
      this.http = new Http(this)
      this.data = null
      this.dataFile = 'box.dat'
      this.logs = []
      this.isMute = false
      this.isNeedRewrite = false
      this.logSeparator = '\n'
      this.encoding = 'utf-8'
      this.startTime = new Date().getTime()
      Object.assign(this, opts)
      this.log('', `🔔${this.name}, 开始!`)
    }

    isNode() {
      return 'undefined' !== typeof module && !!module.exports
    }

    isQuanX() {
      return 'undefined' !== typeof $task
    }

    isSurge() {
      return 'undefined' !== typeof $httpClient && 'undefined' === typeof $loon
    }

    isLoon() {
      return 'undefined' !== typeof $loon
    }

    isShadowrocket() {
      return 'undefined' !== typeof $rocket
    }

    isStash() {
      return 'undefined' !== typeof $environment && $environment['stash-version']
    }

    toObj(str, defaultValue = null) {
      try {
        return JSON.parse(str)
      } catch {
        return defaultValue
      }
    }

    toStr(obj, defaultValue = null) {
      try {
        return JSON.stringify(obj)
      } catch {
        return defaultValue
      }
    }

    getjson(key, defaultValue) {
      let json = defaultValue
      const val = this.getdata(key)
      if (val) {
        try {
          json = JSON.parse(this.getdata(key))
        } catch {}
      }
      return json
    }

    setjson(val, key) {
      try {
        return this.setdata(JSON.stringify(val), key)
      } catch {
        return false
      }
    }

    getScript(url) {
      return new Promise((resolve) => {
        this.get({ url }, (err, resp, body) => resolve(body))
      })
    }

    runScript(script, runOpts) {
      return new Promise((resolve) => {
        let httpapi = this.getdata('@chavy_boxjs_userCfgs.httpapi')
        httpapi = httpapi ? httpapi.replace(/\n/g, '').trim() : httpapi
        let httpapi_timeout = this.getdata('@chavy_boxjs_userCfgs.httpapi_timeout')
        httpapi_timeout = httpapi_timeout ? httpapi_timeout * 1 : 20
        httpapi_timeout = runOpts && runOpts.timeout ? runOpts.timeout : httpapi_timeout
        const [key, addr] = httpapi.split('@')
        const opts = {
          url: `http://${addr}/v1/scripting/evaluate`,
          body: { script_text: script, mock_type: 'cron', timeout: httpapi_timeout },
          headers: { 'X-Key': key, 'Accept': '*/*' }
        }
        this.post(opts, (err, resp, body) => resolve(body))
      }).catch((e) => this.logErr(e))
    }

    loaddata() {
      if (this.isNode()) {
        this.fs = this.fs ? this.fs : require('fs')
        this.path = this.path ? this.path : require('path')
        const curDirDataFilePath = this.path.resolve(this.dataFile)
        const rootDirDataFilePath = this.path.resolve(process.cwd(), this.dataFile)
        const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath)
        const isRootDirDataFile = !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath)
        if (isCurDirDataFile || isRootDirDataFile) {
          const datPath = isCurDirDataFile ? curDirDataFilePath : rootDirDataFilePath
          try {
            return JSON.parse(this.fs.readFileSync(datPath))
          } catch (e) {
            return {}
          }
        } else return {}
      } else return {}
    }

    writedata() {
      if (this.isNode()) {
        this.fs = this.fs ? this.fs : require('fs')
        this.path = this.path ? this.path : require('path')
        const curDirDataFilePath = this.path.resolve(this.dataFile)
        const rootDirDataFilePath = this.path.resolve(process.cwd(), this.dataFile)
        const isCurDirDataFile = this.fs.existsSync(curDirDataFilePath)
        const isRootDirDataFile = !isCurDirDataFile && this.fs.existsSync(rootDirDataFilePath)
        const jsondata = JSON.stringify(this.data)
        if (isCurDirDataFile) {
          this.fs.writeFileSync(curDirDataFilePath, jsondata)
        } else if (isRootDirDataFile) {
          this.fs.writeFileSync(rootDirDataFilePath, jsondata)
        } else {
          this.fs.writeFileSync(curDirDataFilePath, jsondata)
        }
      }
    }

    lodash_get(source, path, defaultValue = undefined) {
      const paths = path.replace(/\[(\d+)\]/g, '.$1').split('.')
      let result = source
      for (const p of paths) {
        result = Object(result)[p]
        if (result === undefined) {
          return defaultValue
        }
      }
      return result
    }

    lodash_set(obj, path, value) {
      if (Object(obj) !== obj) return obj
      if (!Array.isArray(path)) path = path.toString().match(/[^.[\]]+/g) || []
      path
        .slice(0, -1)
        .reduce((a, c, i) => (Object(a[c]) === a[c] ? a[c] : (a[c] = Math.abs(path[i + 1]) >> 0 === +path[i + 1] ? [] : {})), obj)[
        path[path.length - 1]
      ] = value
      return obj
    }

    getdata(key) {
      let val = this.getval(key)
      // 如果以 @
      if (/^@/.test(key)) {
        const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key)
        const objval = objkey ? this.getval(objkey) : ''
        if (objval) {
          try {
            const objedval = JSON.parse(objval)
            val = objedval ? this.lodash_get(objedval, paths, '') : val
          } catch (e) {
            val = ''
          }
        }
      }
      return val
    }

    setdata(val, key) {
      let issuc = false
      if (/^@/.test(key)) {
        const [, objkey, paths] = /^@(.*?)\.(.*?)$/.exec(key)
        const objdat = this.getval(objkey)
        const objval = objkey ? (objdat === 'null' ? null : objdat || '{}') : '{}'
        try {
          const objedval = JSON.parse(objval)
          this.lodash_set(objedval, paths, val)
          issuc = this.setval(JSON.stringify(objedval), objkey)
        } catch (e) {
          const objedval = {}
          this.lodash_set(objedval, paths, val)
          issuc = this.setval(JSON.stringify(objedval), objkey)
        }
      } else {
        issuc = this.setval(val, key)
      }
      return issuc
    }

    getval(key) {
      if (this.isSurge() || this.isLoon()) {
        return $persistentStore.read(key)
      } else if (this.isQuanX()) {
        return $prefs.valueForKey(key)
      } else if (this.isNode()) {
        this.data = this.loaddata()
        return this.data[key]
      } else {
        return (this.data && this.data[key]) || null
      }
    }

    setval(val, key) {
      if (this.isSurge() || this.isLoon()) {
        return $persistentStore.write(val, key)
      } else if (this.isQuanX()) {
        return $prefs.setValueForKey(val, key)
      } else if (this.isNode()) {
        this.data = this.loaddata()
        this.data[key] = val
        this.writedata()
        return true
      } else {
        return (this.data && this.data[key]) || null
      }
    }

    initGotEnv(opts) {
      this.got = this.got ? this.got : require('got')
      this.cktough = this.cktough ? this.cktough : require('tough-cookie')
      this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar()
      if (opts) {
        opts.headers = opts.headers ? opts.headers : {}
        if (undefined === opts.headers.Cookie && undefined === opts.cookieJar) {
          opts.cookieJar = this.ckjar
        }
      }
    }

    get(opts, callback = () => {}) {
      if (opts.headers) {
        delete opts.headers['Content-Type']
        delete opts.headers['Content-Length']
      }
      if (this.isSurge() || this.isLoon()) {
        if (this.isSurge() && this.isNeedRewrite) {
          opts.headers = opts.headers || {}
          Object.assign(opts.headers, { 'X-Surge-Skip-Scripting': false })
        }
        $httpClient.get(opts, (err, resp, body) => {
          if (!err && resp) {
            resp.body = body
            resp.statusCode = resp.status ? resp.status : resp.statusCode
            resp.status = resp.statusCode
          }
          callback(err, resp, body)
        })
      } else if (this.isQuanX()) {
        if (this.isNeedRewrite) {
          opts.opts = opts.opts || {}
          Object.assign(opts.opts, { hints: false })
        }
        $task.fetch(opts).then(
          (resp) => {
            const { statusCode: status, statusCode, headers, body } = resp
            callback(null, { status, statusCode, headers, body }, body)
          },
          (err) => callback((err && err.error) || 'UndefinedError')
        )
      } else if (this.isNode()) {
        let iconv = require('iconv-lite')
        this.initGotEnv(opts)
        this.got(opts)
          .on('redirect', (resp, nextOpts) => {
            try {
              if (resp.headers['set-cookie']) {
                const ck = resp.headers['set-cookie'].map(this.cktough.Cookie.parse).toString()
                if (ck) {
                  this.ckjar.setCookieSync(ck, null)
                }
                nextOpts.cookieJar = this.ckjar
              }
            } catch (e) {
              this.logErr(e)
            }
            // this.ckjar.setCookieSync(resp.headers['set-cookie'].map(Cookie.parse).toString())
          })
          .then(
            (resp) => {
              const { statusCode: status, statusCode, headers, rawBody } = resp
              const body = iconv.decode(rawBody, this.encoding)
              callback(null, { status, statusCode, headers, rawBody, body }, body)
            },
            (err) => {
              const { message: error, response: resp } = err
              callback(error, resp, resp && iconv.decode(resp.rawBody, this.encoding))
            }
          )
      }
    }

    post(opts, callback = () => {}) {
      const method = opts.method ? opts.method.toLocaleLowerCase() : 'post'
      // 如果指定了请求体, 但没指定`Content-Type`, 则自动生成
      if (opts.body && opts.headers && !opts.headers['Content-Type']) {
        opts.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }
      if (opts.headers) delete opts.headers['Content-Length']
      if (this.isSurge() || this.isLoon()) {
        if (this.isSurge() && this.isNeedRewrite) {
          opts.headers = opts.headers || {}
          Object.assign(opts.headers, { 'X-Surge-Skip-Scripting': false })
        }
        $httpClient[method](opts, (err, resp, body) => {
          if (!err && resp) {
            resp.body = body
            resp.statusCode = resp.status ? resp.status : resp.statusCode
            resp.status = resp.statusCode
          }
          callback(err, resp, body)
        })
      } else if (this.isQuanX()) {
        opts.method = method
        if (this.isNeedRewrite) {
          opts.opts = opts.opts || {}
          Object.assign(opts.opts, { hints: false })
        }
        $task.fetch(opts).then(
          (resp) => {
            const { statusCode: status, statusCode, headers, body } = resp
            callback(null, { status, statusCode, headers, body }, body)
          },
          (err) => callback((err && err.error) || 'UndefinedError')
        )
      } else if (this.isNode()) {
        let iconv = require('iconv-lite')
        this.initGotEnv(opts)
        const { url, ..._opts } = opts
        this.got[method](url, _opts).then(
          (resp) => {
            const { statusCode: status, statusCode, headers, rawBody } = resp
            const body = iconv.decode(rawBody, this.encoding)
            callback(null, { status, statusCode, headers, rawBody, body }, body)
          },
          (err) => {
            const { message: error, response: resp } = err
            callback(error, resp, resp && iconv.decode(resp.rawBody, this.encoding))
          }
        )
      }
    }
    /**
     *
     * 示例:$.time('yyyy-MM-dd qq HH:mm:ss.S')
     *    :$.time('yyyyMMddHHmmssS')
     *    y:年 M:月 d:日 q:季 H:时 m:分 s:秒 S:毫秒
     *    其中y可选0-4位占位符、S可选0-1位占位符，其余可选0-2位占位符
     * @param {string} fmt 格式化参数
     * @param {number} 可选: 根据指定时间戳返回格式化日期
     *
     */
    time(fmt, ts = null) {
      const date = ts ? new Date(ts) : new Date()
      let o = {
        'M+': date.getMonth() + 1,
        'd+': date.getDate(),
        'H+': date.getHours(),
        'm+': date.getMinutes(),
        's+': date.getSeconds(),
        'q+': Math.floor((date.getMonth() + 3) / 3),
        'S': date.getMilliseconds()
      }
      if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length))
      for (let k in o)
        if (new RegExp('(' + k + ')').test(fmt))
          fmt = fmt.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length))
      return fmt
    }

    /**
     * 
     * @param {Object} options 
     * @returns {String} 将 Object 对象 转换成 queryStr: key=val&name=senku
     */
    queryStr(options) {
      let queryString = ''

      for (const key in options) {
        let value = options[key]
        if (value != null && value !== '') {
          if (typeof value === 'object') {
            value = JSON.stringify(value)
          }
          queryString += `${key}=${value}&`
        }
      }
      queryString = queryString.substring(0, queryString.length - 1)
    
      return queryString
    }

    /**
     * 系统通知
     *
     * > 通知参数: 同时支持 QuanX 和 Loon 两种格式, EnvJs根据运行环境自动转换, Surge 环境不支持多媒体通知
     *
     * 示例:
     * $.msg(title, subt, desc, 'twitter://')
     * $.msg(title, subt, desc, { 'open-url': 'twitter://', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
     * $.msg(title, subt, desc, { 'open-url': 'https://bing.com', 'media-url': 'https://github.githubassets.com/images/modules/open_graph/github-mark.png' })
     *
     * @param {*} title 标题
     * @param {*} subt 副标题
     * @param {*} desc 通知详情
     * @param {*} opts 通知参数
     *
     */
    msg(title = name, subt = '', desc = '', opts) {
      const toEnvOpts = (rawopts) => {
        if (!rawopts) return rawopts
        if (typeof rawopts === 'string') {
          if (this.isLoon()) return rawopts
          else if (this.isQuanX()) return { 'open-url': rawopts }
          else if (this.isSurge()) return { url: rawopts }
          else return undefined
        } else if (typeof rawopts === 'object') {
          if (this.isLoon()) {
            let openUrl = rawopts.openUrl || rawopts.url || rawopts['open-url']
            let mediaUrl = rawopts.mediaUrl || rawopts['media-url']
            return { openUrl, mediaUrl }
          } else if (this.isQuanX()) {
            let openUrl = rawopts['open-url'] || rawopts.url || rawopts.openUrl
            let mediaUrl = rawopts['media-url'] || rawopts.mediaUrl
            let updatePasteboard = rawopts['update-pasteboard'] || rawopts.updatePasteboard
            return { 'open-url': openUrl, 'media-url': mediaUrl, 'update-pasteboard': updatePasteboard }
          } else if (this.isSurge()) {
            let openUrl = rawopts.url || rawopts.openUrl || rawopts['open-url']
            return { url: openUrl }
          }
        } else {
          return undefined
        }
      }
      if (!this.isMute) {
        if (this.isSurge() || this.isLoon()) {
          $notification.post(title, subt, desc, toEnvOpts(opts))
        } else if (this.isQuanX()) {
          $notify(title, subt, desc, toEnvOpts(opts))
        }
      }
      if (!this.isMuteLog) {
        let logs = ['', '==============📣系统通知📣==============']
        logs.push(title)
        subt ? logs.push(subt) : ''
        desc ? logs.push(desc) : ''
        console.log(logs.join('\n'))
        this.logs = this.logs.concat(logs)
      }
    }

    log(...logs) {
      if (logs.length > 0) {
        this.logs = [...this.logs, ...logs]
      }
      console.log(logs.join(this.logSeparator))
    }

    logErr(err, msg) {
      const isPrintSack = !this.isSurge() && !this.isQuanX() && !this.isLoon()
      if (!isPrintSack) {
        this.log('', `❗️${this.name}, 错误!`, err)
      } else {
        this.log('', `❗️${this.name}, 错误!`, err.stack)
      }
    }

    wait(time) {
      return new Promise((resolve) => setTimeout(resolve, time))
    }

    done(val = {}) {
      const endTime = new Date().getTime()
      const costTime = (endTime - this.startTime) / 1000
      this.log('', `🔔${this.name}, 结束! 🕛 ${costTime} 秒`)
      this.log()
      if (this.isSurge() || this.isQuanX() || this.isLoon()) {
        $done(val)
      } else if (this.isNode()) {
        process.exit(1)
      }
    }
  })(name, opts)
}
