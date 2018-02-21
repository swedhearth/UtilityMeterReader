<?php
if (isset($_POST["json"])){
  $data = json_decode($_POST["json"], true);
  //$data = [['GasReadings', NEW_GAS_OBJ], ['ElectricityReadings', NEW_ELECTRICITY_OBJ]]
  //$data[0] = ['GasReadings', NEW_GAS_OBJ] 
  //$data[0][0] = 'GasReadings' //$data[0][1] = { rDate: "2018-01-22", rValue: 98888 }
  $jsonString = file_get_contents('../database/data.json');
  $tmpArray = json_decode($jsonString, true);
  foreach ($data as $value) {
    //$value = ['GasReadings', NEW_GAS_OBJ]
    //$value[0] = 'GasReadings' //$value[1] = { rDate: "2018-01-22", rValue: 98888 }
    $tmpArray[$value[0]][] = $value[1]; //create a new array's element in GasReading Array
  }
  $newJsonString = json_encode($tmpArray);
  file_put_contents('../database/data.json', $newJsonString); //update database
  file_put_contents("../database/archives/".date("d-m-Y").".mr", $newJsonString); //make archives copy
  echo $newJsonString;
} else {
    $errorEnd = json_encode( ['Error' => "This is ERROR"] );
    echo $errorEnd;
}
?>