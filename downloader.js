var http = require('http');
var fs = require('fs');
var cheerio = require('cheerio');
var _bekazon = require('./bekazon');
var bekazon = new _bekazon();

module.exports = function(){
	var bekazonUrl = 'http://bekazon.com/image/cache/data/digital_comic/';
	
	/**
	downloader function
	*/
	
	var artists = [];
	this.downloadArtist = function(){
		console.log('downloading '+bekazonUrl);
		http.get(bekazonUrl, function(resp){
			var datas = [];
			
			resp.on('data', function(data){
				datas.push(data);
			}).on('end', function(){
				// list of artists
				var stringResponse = Buffer.concat(datas).toString();
				var $ = cheerio.load(stringResponse);
				
				var a = $('a').not(0); // remove up anchor
				if( a.length > 0 ){
					a.each(function(i,e){
						if( !/^coverthumb/ig.test( e.attribs.href ) && e.attribs.href != 'imagecachedata' ){
							var artistName = e.attribs.href.replace( /[^a-z0-9]/ig, '' );
							artists.push( artistName );
						}
					});
					_loopArtist();
				}
			});
		});
	}
	
	function _loopArtist(){
		if( artists.length > 0 ){
			bekazon.saveArtist(artists[0], function(err, result){
				_downloadChapter(artists[0]);
			});
		}else{
			console.log('done');
		}
	}
	
	var chapters = [];
	function _downloadChapter( anArtist ){
		var existingChapter = [];
		bekazon.getChapter(anArtist, null, function(err, savedChapters){
			console.log(err);
			if( savedChapters && savedChapters.length > 0 ){
				existingChapter = savedChapters.map(function(value, index, currentArr){
					//console.log(value.chapter);
					return value.chapter;
				});
			}
			
			//console.log('downloading '+bekazonUrl+anArtist+'/');
			http.get( bekazonUrl+anArtist+'/', function(resp){
				var _data = [];
				resp.on('data', function(data){
					_data.push(data);
				}).on('end', function(){
					var stringResponse = Buffer.concat(_data);
					var $ = cheerio.load(stringResponse);
					var url = $('a');
					
					if( url.length > 0 ){
						//console.log('existingChapter:');
						//console.log(existingChapter);
						url.each(function(i,e){
							if( i > 0 ){
								var chapterName = e.attribs.href.replace(/\/$/g,'');
								if( existingChapter.indexOf( chapterName ) == -1 ){
									chapters.push({
										artist: anArtist,
										chapter:chapterName
									});
								}
							}
						});
					}	
					_loopChapter();
				});
			});
		});
	}
	
	function _loopChapter(){
		if( chapters.length > 0 ){
			_downloadArtworks( chapters[0] );
		}else{
			artists.splice(0,1);
			_loopArtist();
		}
	}
	
	function _downloadArtworks( aChapter ){
		//console.log('downloading '+bekazonUrl+aChapter.artist+'/'+aChapter.chapter+'/');
		http.get( bekazonUrl+aChapter.artist+'/'+aChapter.chapter+'/', function(resp){
			var _data = []; // chunks container
			resp.on('data', function(data){
				_data.push(data); // save each chunk into container
			}).on('end', function(){
				// done downloading HTML content
				//console.log('done.');
				var stringResponse = Buffer.concat(_data); // merge chunks to buffer/string
				var $ = cheerio.load(stringResponse); // create to jQuery-like object
				var url = $('a'); // get only Anchor(a) tag
				
				var artworks = [];
				var thumbnail = '';
				if( url.length > 0 ){ // if got any anchor tag
					url.each(function(i,e){ // loop each artwork url
						if( i > 0 ){ // ignore i=0 (back to parent)
							var artwork = e.attribs.href;
							if( /1140x550/g.test(artwork) ){ // get only artworks with 1140x550 dim
								if( /^t/gi.test( artwork ) ){ // get thumbnail
									thumbnail = bekazonUrl+aChapter.artist+'/'+aChapter.chapter+'/'+artwork;
								}else{
									artworks.push( bekazonUrl+aChapter.artist+'/'+aChapter.chapter+'/'+artwork );
								}
							}
						}
					});
				}
				
				if( thumbnail == '' ){
					thumbnail = artworks[0];
				}
				
				var chapterSummary = {
					chapter: aChapter.chapter,
					thumbnail: thumbnail,
					artworks: artworks
				};
				
				// save chapter+artworks
				bekazon.saveChapter(aChapter.artist, chapterSummary, function(err, result){
					if( err ){
						console.log(err);
					}else{
						console.log('chapter saved!');
					}
					chapters.splice(0,1); // reduce chapter size, array will be re-index
					_loopChapter(); // loop chapter array again
				});
			});
		});
	}	
}
