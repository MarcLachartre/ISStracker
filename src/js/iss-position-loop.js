import Design from "./design.js"
import Device from "./device.js"

export default class IssPositionLoop {
  constructor() {
    this.events = [[document, "keyup"], [document.querySelector(".surface-map").querySelector(".button"), "click"], [window, "focus"]]; //Events on which the app sarts tracking the iss.
  }

  init() { // we want our app to be able to track the ISS for two minutes with a refresh time of 1s. In other words, every second for 2minutes, the app will place the ISS on the map. After 2 minutes a message will ask if the user is stil on the page. It also checks on input that the device is correctly orientated.
    const design = new Design();
    const device = new Device();

    if (!device.isMobileDevice()) {
      console.log("bite")
      design.showAlertBox("fusee", "Hello Space Enthusiast !!!", 'Press your space bar or click the "LOCATE" button to see where the International Space Station currently is!', "GOT IT", "/fusee.png", "fusee", this.startFetchLoop.bind(this), 0);

      this.events.forEach(event => {      
        event[0].addEventListener(event[1], (e) => {    
          const isValidInput = () => { return (e.code === "Space" || e.code === "Enter" || e.type === "click")};
          const alertBoxIsPresent = () => {return document.querySelector(".alert-box") !== null}

          (isValidInput() && alertBoxIsPresent()) ? this.startFetchLoop(0) : false;
        });
      });
    }

    if (device.isMobileDevice()) {
      device.initOrientationMarker();

      design.showAlertBox("fusee", "Hello Space Enthusiast !!!", 'Click the "LOCATE" button to see where the International Space Station currently is!', "GOT IT", "/fusee.png", "fusee", this.startFetchLoop.bind(this), 0);

      // document.querySelector(".surface-map").querySelector(".button").addEventListener("click", () => {
      //   this.startFetchLoop(0);
      // })
      // design.addRotateDeviceListener(this.startFetchLoop.bind(this), 0);
      // (document.querySelector(".button") !== null) ? document.querySelector(".button").addEventListener("click", () => { design.rotateDeviceAlertSelector(this.startFetchLoop.bind(this), 0) }): false
    };
  }

  async startFetchLoop(timer) { //fetch loop is set with a timer, the Design object necessary to show the iss on the map, and the events it has to listen to in order to reset itself.
    const design = new Design();
    design.showIss();
    design.removeAlertBox();

    await this.placeIssOnMap(design); // initial placement of the iss on the map  

    const fetchCount = [];
    const functionExecutionCount = [];

    const device = new Device();
    
    const interval = setInterval(() => {
      console.log(timer)
      // if (device.isPortrait() && device.isMobileDevice()) {
      //   design.showAlertBox("fusee", "Hello Space Enthusiast !!!", 'Click the "LOCATE" button to see where the International Space Station currently is!', "GOT IT", "/fusee.png", "fusee", this.startFetchLoop.bind(this), 0);

      //   clearInterval(interval);
      // }

      if ((timer/10)%1 === 0) { // every second it is refreshing and fetching/placing the ISS on the map
        functionExecutionCount.push("count");

        this.placeIssOnMap(design)
        .catch(response => { // if fetch fails it stops the loop. 
          if (response.message === "false") {
            clearInterval(interval);
            fetchCount.push("error");
            throw Error(response.message);
          }
        }).then(() => {
          fetchCount.push("success");
          return
        })

        if ((functionExecutionCount.length - fetchCount.length) >= 3) { //if the connection is lost close to the end of the interval,set interval loop restarts before the server sends the error. Thats why we implemented the following, if we don't get an answer within one second, the user has to check his connection. If there is a count difference of 2, it means the loop missed one fetch response.
          design.showAlertBox("wormhole", "Hey Astronaut !!!", "Houston here. It seems that you are lost in a wormhole... Please check your connection and retry!", "RETRY", "/wormhole.png", "trounoir", this.startFetchLoop.bind(this), 0);  
          design.hideIss();
          clearInterval(interval);
        }
      }
      
      if (timer === 0) { // add eventListener (only once) so that if the user focuses back on the page or presses any key or the spot iss button, it restarts the interval and also visually spots the iss on the map.
        design.spotISS();

        const handler = (e) => {
          timer = 0;
          document.querySelector(".surface-map").querySelector(".button").removeEventListener("click", handler, true);
          document.querySelector(".surface-map").querySelector(".button").removeEventListener("touchstart", handler, true);
          window.removeEventListener("keyup", handler, true);
          window.removeEventListener("focus", handler, true);
        };

        document.querySelector(".surface-map").querySelector(".button").addEventListener("click", handler, true); 
        document.querySelector(".surface-map").querySelector(".button").addEventListener("touchstart", handler, true); 
        window.addEventListener("keyup", handler, true);
        window.addEventListener("focus", handler, true);
      }

      if (timer >= 1200) { // after 2minutes, the interval stops, iss icon is hidden, no more fetch is done, and a alert box prompts the user to decide whether or not he wants to keep tracking the ISS.
        clearInterval(interval);
        design.showAlertBox("astronaut", "Hey Astronaut !!!", "Houston here. Are you still with us or are you lost in space? Do you copy?", "STILL HERE", "/astronaut.png", "astronaut", this.startFetchLoop.bind(this), 0);
        design.hideIss();
      };

      timer++
    }, 100);
  }

  placeIssOnMap(design) { // fetches coordinates, converts then in position on screen, place an iss icon on the map.
    return new Promise((success, reject) => { 
      this.fetchPosition(success, reject);
    })
    .catch((e)=> {
      if (document.querySelector(".alert-box") === null) {
        design.showAlertBox("wormhole", "Hey Astronaut !!!", "Houston here. It seems that you are lost in a wormhole... Please check your connection and retry!", "RETRY", "/wormhole.png", "trounoir", this.fetchLoop.bind(this), 0);  
        design.hideIss();
      }
        throw Error(false);
    })
    .then((coordinates) => {
      return this.positionOnMap(coordinates);
    })
  }

  fetchPosition(success, reject) { // retrieves the iss coordinates
      var myInit = {method: 'GET'};

      fetch('https://api.wheretheiss.at/v1/satellites/25544.json', myInit)      
      .catch(response => {
        if (!response.ok) {
          reject("false");
          throw(Error(response)) 
        }
        return response;
      })
      .then((response) => {
        return response.json();
      })
      .then(res => {
        success({latitude: res.latitude, longitude: res.longitude}); 
      })
  }

  positionOnMap(coordinates) { //converts the fetched coordinates of the iss into position on screen. With css top and left, we first placed the iss precisely on the center OF THE MAP, then with a cross product, we can place the iss as if we had an axis.
    const longitude = Number(coordinates.longitude);
    const latitude = Number(coordinates.latitude);
 
    const convertedLatitude = this.convertCoordinates(-latitude, 60, 90, 59.9, 96.8, 4.8);
    const convertedLongitude = this.convertCoordinates(longitude, 180, 180, 45, 94, -4);

    document.querySelector(".satellite").style.top = `${convertedLatitude}%`;
    document.querySelector(".satellite").style.left = `${convertedLongitude}%`;
    const convertedCoord = {lat: convertedLatitude, lon: convertedLongitude};

    return convertedCoord
  }

  convertCoordinates(coord, minCoord, maxCoord, centerAxis, maxAxis, minAxis) { // Here's the cross product used to convert the coordinates fetched so that we can position the little ISS icon on the map with css left and top properties. (cross product, produit en croix)
    if (coord < 0) {
      const convertedCoord = centerAxis + ((coord*(centerAxis-minAxis))/maxCoord);
      return convertedCoord
    } else if (coord > 0) {
      const convertedCoord = centerAxis + ((coord*(maxAxis-centerAxis))/minCoord);
      return convertedCoord
    }
  }
}