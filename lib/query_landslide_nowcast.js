var util 		= require('util'),
	fs			= require('fs'),
	async	 	= require('async'),
	path		= require('path'),
	moment		= require('moment'),
	sprintf 	= require("sprintf-js").sprintf,
	_			= require('underscore'),
	Hawk		= require('hawk'),
	filesize 	= require('filesize')
	;

function padDoy( doy ) {
	if( doy < 10 ) {
		doy = "00"+doy
	} else if( doy < 100 ) {
		doy = "0"+doy
	}
	return doy
}

function InBBOX( lat, lon, bbox) {
	if( (lat > bbox[1]) && (lat< bbox[3]) && (lon > bbox[0]) && (lon < bbox[2]) ) return true;
	return false
}

function findRegion(lat, lon) {
	for( var r in app.config.regions ) {
		var region = app.config.regions[r]
		if( InBBOX(lat, lon, region.bbox)) return region
	}
	return undefined
}

function regionId( region ) {
	for( var r in app.config.regions ) {
		var reg = app.config.regions[r]
		if(region == reg ) return r
	}
	return undefined
}

// ===================================================
// 24hr Daily Precip Product

function LandslideNowcastProductId(region, ymd) {
	return "landslide_nowcast_"+regionId(region)+"_"+ymd
}

function findLandslideNowcastProduct(region, ymd, cb ) {
	var trmmid 		= LandslideNowcastProductId(region, ymd)
	var params = {
	  Bucket: region.bucket,
	  Key: path.join( ymd, trmmid + ".topojson.gz")
	}
	
	app.s3.headObject(params, function(err, data) {		
		//console.log("s3 head", params, err)
		if( err ) {
			cb(err, -1)
		} else {
			cb(null, data.ContentLength)
		}
	})
}

function BboxToPolygon(bbox) {
	var minlon = bbox[0]
	var minlat = bbox[1]
	var maxlon = bbox[2]
	var maxlat = bbox[3]
	str = "[["
		str += "["+minlon+", "+minlat+"],"
		str += "["+minlon+", "+maxlat+"],"
		str += "["+maxlon+", "+maxlat+"],"
		str += "["+maxlon+", "+minlat+"],"
	str += "]]"
	return str
}

function checkLandslideNowcast( req, user, ymd, region, credentials, callback ) {
	//console.log("checkLandslideNowcast", ymd)
	var tmp_dir 		= app.get("tmp_dir")
	var user			= req.session.user
	var host 			= req.protocol + "://"+ req.get('Host')
	var originalUrl		= host + req.originalUrl

	findLandslideNowcastProduct(region, ymd, function(err, contentLength) {
		if( !err ) {
			
			var duration		= 60 * 30
			var credentials		= req.session.credentials
			
			function Bewit(url) {
				var bewit = Hawk.uri.getBewit(url, { credentials: credentials, ttlSec: duration, ext: user.email })
				url += "?bewit="+bewit
				return url;
			}
			
			var base_url = host+"/products/"+regionId(region)+"/"+ymd+"/"+LandslideNowcastProductId(region, ymd)
				
			var date 	= moment(ymd, "YYYYMMDD")
			var source	= "NASA GSFC"
			var sensor	= "GSFC Landslide Model";
			
			var properties = {
					"source": {
						"@label": req.gettext("properties.source"),
						"@value": source
					},
					"sensor": {
						"@label": req.gettext("properties.sensor"),
						"@value": sensor
					},
					"date": {
						"@label": req.gettext("properties.date"),
						"@value": date.format(req.gettext("formats.date"))
					},
					"size": {
						"@label": req.gettext("properties.size"),
						"@value": filesize(contentLength)
					},
					"resolution": {
						"@label": req.gettext("properties.resolution"),
						"@value": "~1km from 0.25deg"
					},
					"geometry": {
						"type": "Polygon",
						"coordinates": BboxToPolygon(region.bbox)
					}
			}				
			
			var entry = {
				"@id": 	LandslideNowcastProductId(region, ymd),
				"@type": "geoss:landslide_nowcast",
				"image": [
					{
						"url": base_url+".thn.png",
						"mediaType": "image/png",
						"rel": "browse"
					}
				],
				"properties": properties,
				"action": [
						{
							"@type": 		"ojo:download",
							"displayName": 	"topojson",
							"using": [{
								"@type": 		"as:HttpRequest",
								"method": 		"GET",
								"url": 			Bewit(base_url+".topojson.gz"),
								"mediaType": 	"application/x-gzip",
								"size": 		contentLength,
								"displayName": 	req.gettext("formats.topojsongz")
							},
							{
								"@type": 		"as:HttpRequest",
								"method": 		"GET",
								"url": 			Bewit(base_url+".topojson"),
								"mediaType": 	"application/json",
								"displayName": 	req.gettext("formats.topojson")
							}]								
						},
						{
							"@type": 			"ojo:map",
							"displayName": 	req.gettext("actions.map"),
							"using": [
								{
									"@type": 		"as:HttpRequest",
									"method": 		"GET",
									"@id": 			"legend",
									"url": 			host+"/mapinfo/landslide_nowcast/legend",
									"mediaType": 	"text/html",
									"displayName": 	req.gettext("mapinfo.legend")
								},
								{
									"@type": 		"as:HttpRequest",
									"method": 		"GET",
									"@id": 			"style",
									"url": 			host+"/mapinfo/landslide_nowcast/style",
									"mediaType": 	"application/json",
									"displayName": 	req.gettext("mapinfo.style")
								},
								{
									"@type": 		"as:HttpRequest",
									"method": 		"GET",
									"@id": 			"credits",
									"url": 			host+"/mapinfo/landslide_nowcast/credits",
									"mediaType": 	"application/json",
									"displayName": 	req.gettext("mapinfo.credits")
								}
							]
						},
						{ 
							"@type": 			"ojo:browse",
							"displayName": 		req.gettext("actions.browse"),
							"using": [{
								"@type": 		"as:HttpRequest",
								"method": 		"GET",
								"url": 			base_url+".html",
								"mediaType": 	"html",
							}]
						}
				]
			}
			logger.info("Added entry", JSON.stringify(entry))
			entries.push(entry)
			callback(null)
		} else {
			//logger.error("Error getting Landslide Model", ymd)
			callback(null)
		}
	})
}

function QueryLandslideNowcast(req, user, credentials, host, query, bbox, lat, lon, startTime, endTime, startIndex, itemsPerPage, limit, cb ) {
	if( query != 'landslide_nowcast' ) {
		logger.error("unsupported query", query)
		return cb(null, null)
	}

	// find region of interest
	var region = findRegion(lat, lon)
	if( region === undefined ) {
		logger.error("Undefined region for ", lat, lon)
		return cb(null, null)
	}
	
	if( user == undefined ) {
		logger.error("Undefined user for query ")
		return cb(null, null)
	}
	
	entries		= []

	//console.log("QueryLandslideNowcast", limit, region.name)
	//limit = 2
	
	async.whilst( 
		function() {
			if( entries.length >= limit) {
				//console.log("over entry limit", entries.length)
				return false
			}
				
			if( !endTime.isAfter(startTime) || startTime.isSame(endTime)) {
				//console.log("over time limit", endTime.isAfter(startTime), startTime.isSame(endTime))
				return false
			} 
			return true
		},
		function(callback) {
			var ymd = endTime.format("YYYYMMDD")
		
			checkLandslideNowcast( req, user, ymd, region, credentials, callback )
			endTime.subtract('days', 1);
		},
		function(err) {	
			//console.log("LandslideNowcast Done", err, entries.length)
			var json = {
				replies: {
					items: entries
				}
			}
			cb(null, json)	
		}
	)
}

module.exports.QueryLandslideNowcast	= QueryLandslideNowcast;