'use strict';
/*global $ document window FileReader Uint8Array Image alert confirm Uint32Array Chart*/

var settings  // Global CustomSettings
var oldObj = {}; //Global - downloaded json object - all readings - gas and electric

//Declare Variables for the Meter Reader Display DOM element    
var utilReadValue = 0, // number on meter initially from the database (=oldLastRead) then updated while scrolled
    oldLastRead, //Last Real Read Value from the Database
    oldLastDate, //Last Real Read Date from the Database
    isScrolling, //detects stop of the scrolling event
    disableScroll = false, // if true disables the execution of the scrolling function
    currentScrolTop, // Scroll top of the current element
    scrolToNumber, // Scroll to this number
    fullScroll, // full Scroll Height
    visibleReaderHeight, //Visible height of the number column
    numberHeight,  //Height of the numbCell calculated from the height of visible number column
    avalScroll; //available scroll height

//Declare General Variables
var minDate = new Date(), // declare lowest date to be shown on chart
    maxDate = new Date(0), // declare highest date to be shown on chart
    orginMinDate = 0,
    orginMaxDate = 0,
    wO = {}, // working object - javascript object with calculated difference key + new readings
    currentChart = 0,// currently dispalyed Utility, 0=All Utilities on one chart
    dataset=[], //dataset to draw the Chart
    elIdx = 0, //Working index of Mask Div element
    oKey = "", //Main Key Name of working utility object
    utilImgsArry = [], //array of dataUrl src of taken images of the utility meters
    fromMenuTakeImage = false; // Image has been taken from the menu panel

//Wait for Ajax and Document ready    
$.when(
    //read CustomSettings file ajax
    $.getJSON( "database/customSettings.json" )
        .done(function( json ) {
            settings = json; 
        }),
            
    //read database file ajax
    $.getJSON( "database/data.json" )
        .done(function( json ) {
            oldObj = json; 

        }),
        
    //wait for documen ready
    $(document).ready()
).then(onloadFunction)


function onloadFunction(){
    var tempOldObj = JSON.parse(JSON.stringify(oldObj)); //keep loaded object in var for processing when new data are inputted - temporary old object with new readings (only real readings)

    //Declare frequent jquery DOM Elements
    var $chartSection = $('#chartSection'),
        $chartWrapper = $('#chartWrapper'),
		$numbColumns, //class
		$imageModeless = $("#imageModeless"),
		$maskDiv, //class
		$utilTakeImage = $("#utilTakeImage"),
		$masksSection= $("#masksSection"),
        $readerScrollWrap = $(".readerScrollWrap"),
        $readerScrollWrapClone = $(".readerScrollWrapClone"),
        $utilName = $("#utilName"),
        $inputLabel = $("#inputLabel"),
        $bigImage = $("#bigImage"),
        $readImgInp = $("#readImgInp");

    //Run Main Parser and draw the chart
    parseData(oldObj);
    drawChart();

    //Create the Meter Reader Display DOM element if doesn't exist
	function createMeterDisplay(){
		if(!$numbColumns){
			 var $numbCellsArry = [];
			 var $emptyCellsArry = [];
			 var $emptyCells2Arry = [];
			 var $numbColumnsArry = [];
			 
			 for (var i = 0; i<10; i++){
				$numbCellsArry.push($('<div>', {text: i, class: "numbCells"}));  
			 };
			 for (var i = 0; i<2; i++){
				$emptyCellsArry.push($('<div>', {text: 9, class: "numbCells"}));
			 }
			 for (var i = 0; i<2; i++){
				$emptyCells2Arry.push($('<div>', {text: 0, class: "numbCells"}));
			 }
			 for (var i = 0; i<6; i++){
				$numbColumnsArry.push($('<div>', {class: "numbColumns"}));
			}

			var fullCol = $emptyCellsArry.concat($numbCellsArry, $emptyCells2Arry);
			$readerScrollWrap.append("<div class='readTitle'>New Read:</div>", $numbColumnsArry);
			$numbColumns = $(".numbColumns");
			$numbColumns.append(fullCol).last().addClass( "numbFloatColumn" );
			
			//Call function for scrolling the Meter Reader Display DOM element
			$( window ).resize(function() { scrollToValue($numbColumns, utilReadValue); }); // reload on resize
			$numbColumns.scroll(scrollReaderColumn); //run scrolling function
		}
	}
	
	//Create the Mask Utility imAges DOM element
	(function(){
		var $maskAry=[];
		for (let uty in settings){ //paint masks with images
			let $maskEl = $("<div class='maskDiv'>" 
				+ "<img src=" + settings[uty].utilImg + " class='utilityImages'>" 
				+ "<div>" + uty + "</div></div>");
			$maskAry.push($maskEl);
		}
		$("#maskSlider").append($maskAry)
		$maskDiv = $(".maskDiv");
    })();
	
    //prevent double click on image to save
    $('img').mousedown(function (e) {
        if(e.button == 2) { // right click
          return false; // do nothing!
        }
    });
	
	//disable mobile keyboard popup
	$(":input[type=\"date\"]").attr("disabled","disabled");
	$(":input[type=\"date\"]").hover(function(){
		$(":input[type=\"date\"]").attr("disabled", false); 
	},function(){
		$(":input[type=\"date\"]").attr("disabled","disabled");
	});
    
//Input Click Events
    $("#inputYes").on("click", clickInputYes);
    $("#inputNo").on("click", clickInputNo);

//Input Click event Handlers
    function clickInputNo(e){
        e.stopPropagation();
        $imageModeless.fadeOut("slow");
        if($readerScrollWrapClone.is(":visible")){
            disableScroll = false; //enable scroll function
            $utilTakeImage.show();
            $numbColumns.removeClass( "numbColumnsConfirm" );
            $utilName.removeClass("utilNameConfirm").html(oKey);
            $readerScrollWrapClone.remove();
        }else{
           
            $inputLabel.fadeOut("slow");
            $($masksSection).show()//"slide", function(){
        }
    };

    function clickInputYes(e){
        disableScroll = true; //disable scroll function
        $imageModeless.fadeOut("fast");
        $readerScrollWrapClone.is(":visible")? submitData(e) : confirmData();
    }
    
// New Data confirmation
    function confirmData(){
        var sumRead=0; //sum of all readings (true and calculated of the working utility)
        for (var i = 0; i < dataset[elIdx].data.length; i++){
            sumRead += dataset[elIdx].data[i].y
        }
        var avgRead = sumRead/i;//Average of all readings (true and calculated of the working utility)
        
        $readerScrollWrapClone = $readerScrollWrap.clone(true).insertAfter($readerScrollWrap).addClass("readerScrollWrapClone");
        $( ".readerScrollWrapClone .numbColumns").addClass( "numbColumnsClone numbColumnsConfirm" );
        $numbColumns.addClass( "numbColumnsConfirm" );
        $(".readerScrollWrapClone .readTitle").html("Old Read:");
        $utilName.addClass("utilNameConfirm").html(oKey + " reading difference between <br>" 
            + oldLastDate + " ( " +  oldLastRead.toFixed(1) + " units )"
            + " and <br>" + $("#utilReadDate").val() + " ( " +  utilReadValue.toFixed(1) + " units )" + " is <p><b>" 
            + ((utilReadValue - oldLastRead).toFixed(1)) 
            + "</b> units. </p><div><i>The average monthly usage, based on the last " + i 
            + " months is <span><b>" + avgRead.toFixed(1) + "</b> units.</i></span></div>");                    
        
        scrollToValue($(".numbColumnsClone"), oldLastRead);

        $utilTakeImage.hide();
        
        $( window ).resize(function() {
            scrollToValue($numbColumns, utilReadValue); 
            scrollToValue($(".numbColumnsClone"), oldLastRead);
        }); // reload on resize
    }
    
// New Data Submission
    function submitData(e){
        var newObj = {
            "rDate" : $("#utilReadDate").val(),
            "rValue" : parseInt(utilReadValue) //parseInt($("#utilReadValue").val())
        };
        var postArray =[[oKey, newObj]];
        $.ajax({
            type: "POST",
            url: "scripts/saveData.php",
            data: {json: JSON.stringify(postArray)},
            dataType: "json"
        })
        .done(submitSucess)
        .fail(submitFail);
    }
    
    function submitSucess(e){
        tempOldObj[oKey].push({rDate : $("#utilReadDate").val(), rValue : parseInt(utilReadValue)});
        parseData(tempOldObj);
        drawChart();
        alert("Meter reading has been sucessfully submitted.");
        $maskDiv[elIdx].childNodes[1].style.color = "green";
        $maskDiv[elIdx].childNodes[1].innerHTML += ":<br>" + parseInt(utilReadValue);
        clickInputNo(e); //remove Clone
        clickInputNo(e); // Hide input Label
    }
    
    function submitFail(){
        alert("Upss... \n\nThere is server connection problem and this meter reading has NOT been submitted\n\nPlease try again later");
        $maskDiv[elIdx].childNodes[1].style.color = "red";
    }
                 


                
                
		$readImgInp.change(function() {
			insertImage(this, $utilTakeImage);
		});

		//insert image Image clicking on camera icon
		function insertImage(element, image){
			var file = element.files[0];

			var fileType = file["type"];
			var ValidImageTypes = ["image/gif", "image/jpeg", "image/png"];
			if ($.inArray(fileType, ValidImageTypes) < 0) {
				alert("Upps...\n\nThis file does not appear to be a valid image.");
				return;
			}
			var reader = new FileReader();
			reader.onload = function(e) {
				var bin = e.target.result;
				var bImg = new Image;
				bImg.src = bin;
				bImg.onload = function() {
					var imgW = ($bigImage.height() * bImg.width) / bImg.height;
					var canvas = document.createElement("canvas");
					canvas.height = $bigImage.height();
					canvas.width = imgW;
					var ctx = canvas.getContext("2d");
					ctx.drawImage(bImg, 0, 0, canvas.width, canvas.height);
					var dt = canvas.toDataURL("image/jpeg", 0.7);
			
					utilImgsArry[elIdx] = dt;
					$(image).attr("src",dt).off("click")
                    .on("click", function(){
						$bigImage.attr("src",dt);
						$imageModeless.fadeIn("slow");
                    });
					if(fromMenuTakeImage){
						clickMenuTakeImage(e);
					}
				};
			};
			reader.readAsDataURL( file );
		}

		$imageModeless.click(function(event){
			event.stopPropagation();
		});


		// -------*******************--------LEFT MENU-------*******************--------//
		$(".menuButtons").click(function(){
			hideMenu(); 
		});

		$("#menuImg").click(function(e){
			if($("#menuSection").height()>0){
				hideMenu();
			}else{
				showMenu(e);
			}
		});

		function showMenu(e){
			if($readerScrollWrapClone.is(":visible")){
                clickInputNo(e);
			};
            $imageModeless.fadeOut("slow");

			$inputLabel.fadeOut("slow");
			$("#menuSection").css("height", "100vh"); 
			$("#menuOptionsSubsection").css("transform", "translateY(0)"); 

		}

		function hideMenu(){
			if($("#menuSection").height()>0){
				$("#menuOptionsSubsection").css("transform", "translateY(-112vh)");
				$("#menuSection").css("height", "0");
			}
		}

		$(document.body).on("click", function () {
			$masksSection.hide("slide"); //jquery UI
			$("#dateFilter").hide("slide"); //jquery UI
			hideMenu();
		});
		
		$masksSection.on("click", function (e) {
			e.stopPropagation();
		});  

///////////////////////////////////////////////////////////
		$("#inputData").on("click", clickInputData); 
        
        function clickInputData(e) {
			e.stopPropagation();
			createMeterDisplay();
			$("#maskTitle").attr("src", "images/Input.png");
			$maskDiv.off("click").on("click", makeInputData)
			$masksSection.show("slide");//jquery UI
		};
		
		function makeInputData(e){
			makeShowUtilities(e);
			oKey = Object.keys(tempOldObj)[elIdx];
            oldLastRead = tempOldObj[oKey][tempOldObj[oKey].length - 1].rValue;
            oldLastDate = tempOldObj[oKey][tempOldObj[oKey].length - 1].rDate;
			$utilTakeImage.off("click");
			if(utilImgsArry[elIdx]){
				$utilTakeImage.attr( "src", utilImgsArry[elIdx] )
				.click(function() {
					$bigImage.attr("src",utilImgsArry[elIdx]);
					$imageModeless.fadeIn("slow");
				});
			}else{
				$utilTakeImage.attr( "src", "images/Camera.png" )
				.click(function() {//Take Utility Image clicking on camera icon
					$readImgInp.click();
				});
			}
			$utilName.html(oKey);
			utilReadValue = oldLastRead;
			$("#utilReadDate").val(new Date().toDateInputValue());
			disableScroll = true; //disable scroll function
			$inputLabel.fadeIn("slow"); // show input label
			scrollToValue($numbColumns, utilReadValue); //show the utilityReadValue in the meter reader display:
			disableScroll = false; //disable scroll function
		}           
/////////////////////////////////////////////////////////////////////
		$("#showUtilities").on("click", clickShowUtilities);
        
        function clickShowUtilities(e){
			e.stopPropagation();
			$("#maskTitle").attr("src", "images/Show.png");
			$maskDiv.off("click").on("click", makeShowUtilities);
			$masksSection.show("slide");//jquery UI
		};

		function makeShowUtilities(e){
			elIdx = $maskDiv.index( e.currentTarget );
			drawChart([dataset[elIdx]]);
		}           
/////////////////////////////////////////////////////////////////////
		$("#menuTakeImage").on("click", clickMenuTakeImage);

		function clickMenuTakeImage(e){
			e.stopPropagation();
			$("#maskTitle").attr("src", "images/Camera.png");
			$(".utilityImages").each(function(index){
				if(utilImgsArry[index]){
					$(".utilityImages").eq(index).attr("src",utilImgsArry[index]);
				}
			});                
			$maskDiv.off("click").on("click", makeMenuTakeImage);//.on("click", makeShowUtilities);
			$masksSection.show("slide");//jquery UI
        }
        
		function makeMenuTakeImage(e){
			fromMenuTakeImage = true;
			$readImgInp.click();
			makeShowUtilities(e);
		}
/////////////////////////////////////////////////////////////////

		$("#addUtility").on("click", function (event) {
			var $newUtyModal = $('<div>', {class: "newUtyModal"});
			var $newUtyWrap = $('<div>', {class: "newUtyWrap"});
			var $form = $("<form></form>");
			$form.append('<input type="text" placeholder="Utility Name">');
			$($newUtyWrap).append($form);
			$($newUtyModal).append($newUtyWrap);
			$("body").append($newUtyModal);
		 });  



/////////////////////////////////////////////////////////////////

		
		$("#filterData").on("click", function (event) {
			event.stopPropagation();
			$("#dateFilter").show("slide");//jquery UI 
		});
		
		$("#dateFilter").on("click", function (event) {
			event.preventDefault();
			event.stopPropagation();
		});

		$("#chartStartDate").change(function(){
			minDate = new Date($("#chartStartDate").val());
			drawChart();
		});

		$("#chartEndDate").change(function(){
			maxDate = new Date($("#chartEndDate").val());
			drawChart();
		});
	// -------*******************-------- END LEFT MENU-------*******************--------//

		function parseData(oldObj){
			wO = JSON.parse(JSON.stringify(oldObj));

			oldObj = JSON.parse(JSON.stringify(oldObj), function ( key, value ){ //parse json with reviver
				if(key == "rDate"){
					minDate = new Date(value) < minDate? new Date(value) : minDate;
					maxDate = new Date(value) > maxDate? new Date(value) : maxDate;
					return new Date(value);
				}
				else{
					return value;
				}
			} );
				orginMinDate = new Date(minDate.getTime());
				orginMaxDate = new Date(maxDate.getTime());
			   // minDate = new Date(maxDate.getTime() - (1000*3600*24*365));
			var bc = 0;
			dataset=[]; // reset dataset
			for (let i in oldObj){ // iterate through main object's keys (GasReadings, ElectricityReadings)
				sortResults(oldObj[i], "rDate", true); //Sort main object's values by date ascending (necessary?)

				wO[i] = []; //clear main object's key values
				wO[i].data = [{t : oldObj[i][0].rDate, y : 0}];
				wO[i].pointBackgroundColor = ["black"];
				wO[i].rValue = [oldObj[i][0].rValue];
	
				for (let j = 1; j < oldObj[i].length; j++){ //iterate through main object's values starting from the second value
					var timeDiff = Math.abs(oldObj[i][j].rDate.getTime() - oldObj[i][j-1].rDate.getTime());
					var diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));
					var difValue  = oldObj[i][j].rValue - oldObj[i][j-1].rValue;
		
					if(diffDays>50){  //will be 50
						var firstVirtDate = setThisDate(oldObj[i][j].rDate); //currently processed Real Reading date
						var secondVirtDate = setThisDate(oldObj[i][j-1].rDate); //previous date of the Real Read
						var monthsDifference = getMonthsDifference(firstVirtDate, secondVirtDate);
					
						for (let m = 1; m < monthsDifference; m++){
							secondVirtDate.setMonth(secondVirtDate.getMonth()+1);
							var calcDate = new Date(secondVirtDate);
				
							wO[i].data.push({t : calcDate, y : Math.round(difValue/monthsDifference)});
							wO[i].pointBackgroundColor.push("white");
							wO[i].rValue.push("Calculated");
						}
			
						wO[i].data.push({t : oldObj[i][j].rDate, y : Math.round(difValue/monthsDifference)});
						wO[i].pointBackgroundColor.push("green");
						wO[i].rValue.push(oldObj[i][j].rValue);
			 
					}else{
						wO[i].data.push({t : oldObj[i][j].rDate, y : difValue});
						wO[i].pointBackgroundColor.push("green");
						wO[i].rValue.push(oldObj[i][j].rValue);
					}
				}
				var obKey = Object.keys(tempOldObj)[bc];
				dataset.push({
					label: i + " Usage from the last Reading",
					backgroundColor: "rgba(" + settings[obKey].borderCol + ", 0.1)", //"rgba(" + borderCol[bc] + ", 0.1)",
					borderColor: "rgb(" + settings[obKey].borderCol + ")",
					data: wO[i].data,
					hoverRadius: 10,
					hitRadius: 20,
					pointBackgroundColor: wO[i].pointBackgroundColor
				});
				bc++;
			}
			function getMonthsDifference(firstVirtDate, secondVirtDate){
				var months;
				months = (firstVirtDate.getFullYear() - secondVirtDate.getFullYear()) * 12;
				months -= secondVirtDate.getMonth();
				months += firstVirtDate.getMonth();
				return months <= 0 ? 0 : months;
			} 

			function setThisDate(tDate){ //set date to the beggining of the month (this - beore 16th or next - after 15th)
				var thisDate = new Date(tDate);
				var lastReadDay = thisDate.getDate();
				var daysInTheMonth = new Date(thisDate.getFullYear(), thisDate.getMonth()+1, 0).getDate();
				lastReadDay > 15 ? thisDate.setDate(lastReadDay + (daysInTheMonth-lastReadDay)+1) : thisDate.setDate(1);
				return thisDate;
			} 
		}

		function drawChart(ds=dataset){
			var thisDataset = ds;

			$("#chartWrapper").html("");
			var nCanv = $("<canvas/>", {id: "theChart"});
			$("#chartWrapper").append(nCanv);

			var ctx = document.getElementById("theChart").getContext("2d");
			new Chart(ctx, {
				type: "line",

				data: {
					datasets: thisDataset
				},

				options: {
					scales: {
						xAxes: [{

							type: "time",
							time: {
								unit: "month",
								unitStepSize: 1,
								tooltipFormat: "DD MMMM YYYY (dddd)",
								max: maxDate,
								min: minDate
							},
							scaleLabel: {
								labelString: "Month"
							},
							ticks: {
								stepSize: 1,
								min: 0,
								autoSkip: true
							}
						}]
					},

					legend: {
						position: "bottom",
						display: true,
						labels: {
							fontColor: "rgb(115, 115, 115)"
						}
					},

					title: {
						display: true,
						position: "right",
						text: "Meter Readings"
					},

					tooltips: {
						callbacks: {
							footer:function(tooltipItems){
								var idx = currentChart===0 ? tooltipItems[0].datasetIndex:currentChart-1; 
								var oKey = Object.keys(wO)[idx]; //fetched the key at idx index
								return "Meter Reading: " + wO[oKey].rValue[tooltipItems[0].index];
							}
						}
					},
			
					animation: {
						duration: 0, // general animation time
					},
				
					hover: {
						animationDuration: 0, // duration of animations when hovering an item
					},
			
					responsiveAnimationDuration: 0, // animation duration after a resize
					maintainAspectRatio: false
				}
			});
		}

		Date.prototype.toDateInputValue = (function() {
			var local = new Date(this);
			local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
			return local.toJSON().slice(0,10);
		});

		function sortResults(readings, prop, asc) {
			readings = readings.sort(function(a, b) {
				if (asc) {
					return (a[prop] > b[prop]) ? 1 : ((a[prop] < b[prop]) ? -1 : 0);
				} else {
					return (b[prop] > a[prop]) ? 1 : ((b[prop] < a[prop]) ? -1 : 0);
				}
			});
		}

		$("#moveRight").click(function(){
			currentChart++;
			if (currentChart>dataset.length){
				currentChart=0;
				drawChart();
			}else{
				drawChart([dataset[currentChart-1]]);
				drawTable();
			}
		});
		
		$("#moveLeft").click(function(){
			currentChart--;
			if(currentChart<0){currentChart=dataset.length};
			if(currentChart===0){
				drawChart();
			}else{
				drawChart([dataset[currentChart-1]]);//2;
				drawTable();
			}
		});
		
		function drawTable(){
			$("#rTbody").html("");
			var sarray = $.map(tempOldObj, function(value) {
				return [value];
			});
			for(let i=sarray[currentChart-1].length-1; i>0; i--){
			   // var rD = new Date(sarray[currentChart-1][i].rDate);
			   // if (rD >= minDate & rD <= maxDate){
					$("#rTbody").append("<tr><td>" + sarray[currentChart-1][i].rDate 
					+ "</td><td>" 
					+ sarray[currentChart-1][i].rValue + "</td><td>" 
					+ (sarray[currentChart-1][i].rValue - sarray[currentChart-1][i-1].rValue) 
					+ "</td></tr>");
			   // }
			}
			var obKey = Object.keys(settings)[currentChart-1];
			var bCol = settings[obKey].borderCol;
			$( "#rTbody tr:nth-child(even)" ).css( "background", "rgba(" + bCol + ", 0.5)" );
			$( "#rTbody tr:nth-child(odd)" ).css( "background", "rgba(" + bCol + ", 0.3)" );
			$( "#rThead tr" ).css( "background", "rgba(" + bCol + ", 1)" );
		}
		
		
		$("#showChart").click(function(){
			$("#showTable").click();
		})

		$("#showTable").click(function(){
			$(this).toggle();
			$("#showChart").toggle();
			$chartSection.toggle("fade");
			$("#readingsSection").toggle("fade");
		});
var cWidth = 100; //width of #chartWrapper in vw
var cLeft = 0;   
var scL = 0; //scroll Left position
var clientWidth = $("#mainSection").innerWidth();
var w = clientWidth/100; 

var zoomPlus = 20; //20vw - increase the size of the '#chartWrapper' by 20vw

$( "#chartSection" ).scroll(function() {
  $( "#testTabel" ).html( $('#chartSection').scrollLeft() );
});
            $( "#zoomIn" ).click(function(){
                
                var cWitdhPx = cWidth * w; //width of #chartWrapper in pixels
                scL = $chartSection.scrollLeft();
                var zoomBy = Math.round((((clientWidth/2 + scL) / cWitdhPx)  * clientWidth / 100) * zoomPlus);                

                cWidth+= zoomPlus;
                var scrollTotal = scL + zoomBy;
      // $(".optionButtons")css({"pointer-events" : "none"});
	   $( ".optionButtons" ).css( 'pointer-events', 'none' );
       
                $($chartWrapper).animate({width: cWidth + "vw"}, {
					queue: false, 
					duration: 200
					});
                $($chartSection).animate({scrollLeft: scrollTotal},	{ 
					queue: false, 
					duration: 200 ,
					complete: function() {
						$( ".optionButtons" ).css( 'pointer-events', 'auto' );
							//alert("scroll compl");

					}
				});

                
/*                 maxDate.setMonth(maxDate.getMonth()-1);
                minDate.setMonth(minDate.getMonth()+1);
                if(maxDate>minDate){
                    (currentChart)>0? drawChart([dataset[currentChart-1]]) : drawChart();
                    drawTable();
                }else{
                    maxDate.setMonth(maxDate.getMonth()+1);
                    minDate.setMonth(minDate.getMonth()-1);
                } */
            });
    
            $( "#zoomOut" ).click(function() {

                cWidth-= 4;
                cLeft +=2;
                
                //$( "#chartSection" ).scrollLeft = cWidth*100;
                document.getElementById('chartSection').scrollLeft -= 0.2;
$( "#chartWrapper" ).css("width", cWidth + "vw");
                //console.log("cWidth: " + cWidth + " / cLeft: " + cLeft);
                
/*                 if(maxDate < orginMaxDate){
                    maxDate.setMonth(maxDate.getMonth()+1);
                }
                if(minDate > orginMinDate){
                    minDate.setMonth(minDate.getMonth()-1);
                }
                (currentChart)>0? drawChart([dataset[currentChart-1]]) : drawChart();
                drawTable(); */
            });
            
            $( "#zoomCancel" ).click(function() {
                cWidth = 100;
                
                $($chartWrapper).animate({width: cWidth + "vw"}, { queue: false, duration: 1000 });
                $($chartSection).animate({scrollLeft: 0}, { queue: false, duration: 1000 });
                

/*                 cWidth=100;
                cLeft = 0;
                $( "#chartWrapper" ).css("left", cLeft + "vw");
                document.getElementById('chartSection').scrollLeft += 20; */

/*                 minDate = new Date(orginMinDate.getTime());
                maxDate = new Date(orginMaxDate.getTime());
                (currentChart)>0? drawChart([dataset[currentChart-1]]) : drawChart();
                drawTable(); */
            });



            //$(function() {
            //     var xPos = 0;
            //    $("#masksSection").swipe( {
            //          //Generic swipe handler for all directions
            //         swipe:function(event, direction, distance, duration, fingerCount, fingerData) {
                
            //             if(direction == "left"){
            //                 $("#maskSlider").css("transform","translateX(-" + (distance - xPos) + "px)");
            //                 xPos = distance;
            //                 //$("#maskSlider").css("left", distance + "px");
            //                 //$("#maskSlider").css("transform","translateX(0px)");
            //                 //alert("left, Distance: " + distance + ". Duration: "+ duration);
            //              }else{
            //                  $("#maskSlider").css("transform","translateX(" + (distance + xPos) +"px)");
            //                  //$("#maskSlider").css("left", distance + "px");
            //                  //$("#maskSlider").css("transform","translateX(0px)");
            //                  //alert("other");
            //                  xPos = distance;
            //              }
            //          },
            //          threshold:0
            //      });

            //console.log("other outside");
            // $("#tspOnMachines").swipe( {
            // //Generic swipe handler for all directions
            // swipe:function(event, direction, distance, duration, fingerCount, fingerData) {
            // if(direction == "right"){
            // tspToggle();
            // document.getElementById("one").checked= false;
            // }
            // }
            // }); 
    
            // });
            
            

            
            
  //      });
/////////--------------Functions for scrolling the Meter Display -------------------------////////////////////
            // Functions for scrolling the Meter Display 
             function scrollToValue(display, utVal){
               fullScroll = $numbColumns.prop("scrollHeight"); //567
               visibleReaderHeight = $numbColumns.height();
               numberHeight = visibleReaderHeight/2;
               avalScroll = fullScroll - visibleReaderHeight;
             //console.log(utVal)
              var fixedFloat = utVal.toFixed(1).toString(10).padStart(7,"0"); //translate the integer or float to fixed float string of '00000.0' format
              var readArray = fixedFloat.replace(/\D/g, '').split('').map(Number); //translate the fixed float to array with removed '.' (dot)
              var count=0;
             
                display.each(function(index){
                  var thisEl = $(this);
                  $(thisEl).scrollTop($(thisEl).children().eq(readArray[count] + 1)[0].offsetTop + numberHeight/2);
                  count++;
                });
             }

             function scrollReaderColumn (){ 
                if(!disableScroll && numberHeight){
                  var thisEl = $(this);
                  currentScrolTop = thisEl.scrollTop();
                  scrolToNumber = Math.round((currentScrolTop-numberHeight/2)/numberHeight);

                  ////// rewind to top if at the bottom
                  if(currentScrolTop > avalScroll - numberHeight){
                    $(thisEl).scrollTop($(thisEl).children().eq(1)[0].offsetTop + numberHeight);
                  }
                  ////// rewind to bottom if at the top
                  if(currentScrolTop < numberHeight){
                    $(thisEl).scrollTop($(thisEl).children().eq(10)[0].offsetTop + numberHeight/3);
                  }

                  // Clear our timeout throughout the scroll
                  window.clearTimeout( isScrolling );

                  // Set a timeout to run after scrolling ends
                  isScrolling = setTimeout(function() {
                    disableScroll = true; //disable scroll function
                    $(thisEl).animate({scrollTop: $(thisEl).children().eq(scrolToNumber)[0].offsetTop + numberHeight/2}, 200);
                    
                    disableScroll = setTimeout(function() { 
                      disableScroll = false //enable the scroll function
                    }, 60);
                    updateReadValue(); //retrieve the current reader value
                  }, 66);
                }
             }
             
             function updateReadValue (){
                var fulNumb = "";
                  $numbColumns.each(function(index){
                    var thisEl = $(this);
                    currentScrolTop = thisEl.scrollTop();
                    scrolToNumber = Math.round((currentScrolTop-numberHeight/2)/numberHeight);
                    fulNumb +=  thisEl.children().eq(scrolToNumber+1).html();
                  })
                utilReadValue = parseFloat((parseInt(fulNumb)/10).toFixed(1));
             }
/////////--------------END Functions for scrolling the Meter Display -------------------------////////////////////
}
//});