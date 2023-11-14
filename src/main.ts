import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board";
const NULL_ISLAND = leaflet.latLng({
  lat: 0,
  lng: 0,
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
  center: NULL_ISLAND,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: `&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>`,
  })
  .addTo(map);

interface Coin {
  readonly i: number;
  readonly j: number;
  readonly serial: number;
}

let playerCoins: Coin[];

class Geocache implements Momento<string> {
  i: number;
  j: number;
  coins: Coin[] = [];

  constructor(i: number, j: number) {
    this.i = i;
    this.j = j;
  }

  gennerateCoins() {
    this.coins = new Array<Coin>(
      Math.floor(luck([this.i, this.j, "initialValue"].toString()) * 100)
    );
    for (let serial = 0; serial < this.coins.length; serial++) {
      this.coins[serial] = { i: this.i, j: this.j, serial };
    }
  }

  get momentoKey() {
    return `${this.i},${this.j}`;
  }

  toMomento() {
    return JSON.stringify(this.coins);
  }

  fromMomento(momento: string) {
    this.coins = JSON.parse(momento) as Coin[];
  }
}

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

const cacheLayers = leaflet.layerGroup().addTo(map);

function makeCache(i: number, j: number) {
  const bounds = board.getCellBounds({ i, j });

  const cacheLayer = leaflet.rectangle(bounds) as leaflet.Layer;

  const cache = new Geocache(i, j);

  const storedMemento = localStorage.getItem(cache.momentoKey);
  if (!storedMemento) {
    cache.gennerateCoins();
    localStorage.setItem(cache.momentoKey, cache.toMomento());
  } else {
    cache.fromMomento(storedMemento);
  }

  function displayText(coin: Coin) {
    return `${coin.i}:${coin.j}#${coin.serial}`;
  }

  function buttonId(coin: Coin) {
    return `b${coin.i}_${coin.j}_${coin.serial}`;
  }

  function spanId(coin: Coin) {
    return `s${coin.i}_${coin.j}_${coin.serial}`;
  }

  function hideCoinHTML(elem: HTMLUListElement, coin: Coin) {
    elem
      .querySelector<HTMLSpanElement>(`#${spanId(coin)}`)!
      .parentElement!.classList.add("hidden");
  }

  function revealCoinHTML(elem: HTMLUListElement, coin: Coin) {
    elem
      .querySelector<HTMLSpanElement>(`#${spanId(coin)}`)!
      .parentElement!.classList.remove("hidden");
  }
  cacheLayer.bindPopup(
    () => {
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.alignContent = "space-around";
      container.innerHTML += `<ul id="playerCoins">(Player Coins)</ul><hr><ul id="cacheCoins">(Cache Coins)</ul>`;

      const playerCoinsElem =
        container.querySelector<HTMLUListElement>("#playerCoins")!;
      const cacheCoinsElem =
        container.querySelector<HTMLUListElement>("#cacheCoins")!;

      const allCoins = playerCoins.concat(cache.coins);

      for (const coin of allCoins) {
        playerCoinsElem.innerHTML += `<li><span id=${spanId(
          coin
        )}>${displayText(coin)}\t</span><button id=${buttonId(
          coin
        )}>></button></li>`;
        cacheCoinsElem.innerHTML += `<li><button id=${buttonId(
          coin
        )}><</button><span id=${spanId(coin)}>\t${displayText(
          coin
        )}</span></li>`;
      }

      for (const coin of playerCoins) {
        hideCoinHTML(cacheCoinsElem, coin);
      }

      for (const coin of cache.coins) {
        hideCoinHTML(playerCoinsElem, coin);
      }

      for (const coin of allCoins) {
        let button = playerCoinsElem.querySelector<HTMLButtonElement>(
          `#${buttonId(coin)}`
        )!;
        button.addEventListener("click", () => {
          // ev.stopPropagation();
          cache.coins.push(playerCoins.splice(playerCoins.indexOf(coin), 1)[0]);
          localStorage.setItem(cache.momentoKey, cache.toMomento());
          hideCoinHTML(playerCoinsElem, coin);
          revealCoinHTML(cacheCoinsElem, coin);
          localStorage.setItem("playerCoins", JSON.stringify(playerCoins));
        });

        button = cacheCoinsElem.querySelector<HTMLButtonElement>(
          `#${buttonId(coin)}`
        )!;
        button.addEventListener("click", () => {
          // ev.stopPropagation();
          playerCoins.push(cache.coins.splice(cache.coins.indexOf(coin), 1)[0]);
          localStorage.setItem(cache.momentoKey, cache.toMomento());
          hideCoinHTML(cacheCoinsElem, coin);
          revealCoinHTML(playerCoinsElem, coin);
          localStorage.setItem("playerCoins", JSON.stringify(playerCoins));
        });

        let span = playerCoinsElem.querySelector<HTMLSpanElement>(
          `#${spanId(coin)}`
        )!;
        span.addEventListener("click", () => {
          map.setView(
            leaflet.latLng(coin.i * TILE_DEGREES, coin.j * TILE_DEGREES)
          );
        });

        span = cacheCoinsElem.querySelector<HTMLSpanElement>(
          `#${spanId(coin)}`
        )!;
        span.addEventListener("click", () => {
          map.setView(
            leaflet.latLng(coin.i * TILE_DEGREES, coin.j * TILE_DEGREES)
          );
        });
      }
      return container;
    },
    { maxWidth: 500 }
  );
  cacheLayer.on("popupclose", () => generate());
  cacheLayers.addLayer(cacheLayer);
}
const playerMarker = leaflet.marker(NULL_ISLAND);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

class Path {
  polys: leaflet.LayerGroup<leaflet.Polyline>;
  current: leaflet.Polyline;
  constructor() {
    this.polys = leaflet
      .layerGroup()
      .addTo(map) as leaflet.LayerGroup<leaflet.Polyline>;
    this.current = leaflet.polyline([], { color: "red" });
    this.current.addTo(this.polys);
  }
  toMomento() {
    const strings = [];
    for (const poly of this.polys.getLayers() as leaflet.Polyline[]) {
      strings.push(JSON.stringify(poly.getLatLngs()));
    }
    return JSON.stringify(strings);
  }
  fromMomento(momento: string) {
    this.polys.clearLayers();
    const strings = JSON.parse(momento) as string[];
    for (const string of strings) {
      const poly = leaflet.polyline(JSON.parse(string) as leaflet.LatLng[], {
        color: "red",
      });
      poly.addTo(this.polys);
    }
    this.newPoly();
  }

  newPoly() {
    this.current = leaflet.polyline([], { color: "red" });
    this.current.addTo(this.polys);
  }
}

const path = new Path();

const storedPlayerPath = localStorage.getItem("path");

if (storedPlayerPath) {
  path.fromMomento(storedPlayerPath);
}

function movePlayer(latLng: leaflet.LatLng) {
  playerMarker.setLatLng(latLng);
  path.current.addLatLng(latLng);
  localStorage.setItem("path", path.toMomento());
  if (cacheLayers.getLayers().every((layer) => !layer.isPopupOpen())) {
    generate();
  }
}

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  path.newPoly();
  navigator.geolocation.watchPosition((position) => {
    const latLng = leaflet.latLng(
      position.coords.latitude,
      position.coords.longitude
    );
    movePlayer(latLng);
  });
});

const resetButton = document.querySelector("#reset")!;
resetButton.addEventListener("click", () => {
  const response = window.prompt("Erase Save Data? [y/n]");
  if (
    response == "y" ||
    response == "yes" ||
    response == "Yes" ||
    response == "YES"
  ) {
    localStorage.clear();
    path.polys.clearLayers();
    path.newPoly();
    movePlayer(playerMarker.getLatLng());
    generate();
  }
});

const northButton = document.querySelector("#north")!;
northButton.addEventListener("click", () => {
  const current = playerMarker.getLatLng();
  const latLng = leaflet.latLng(current.lat + TILE_DEGREES, current.lng);
  movePlayer(latLng);
});

const southButton = document.querySelector("#south")!;
southButton.addEventListener("click", () => {
  const current = playerMarker.getLatLng();
  const latLng = leaflet.latLng(current.lat - TILE_DEGREES, current.lng);
  movePlayer(latLng);
});

const eastButton = document.querySelector("#east")!;
eastButton.addEventListener("click", () => {
  const current = playerMarker.getLatLng();
  const latLng = leaflet.latLng(current.lat, current.lng + TILE_DEGREES);
  movePlayer(latLng);
});

const westButton = document.querySelector("#west")!;
westButton.addEventListener("click", () => {
  const current = playerMarker.getLatLng();
  const latLng = leaflet.latLng(current.lat, current.lng - TILE_DEGREES);
  movePlayer(latLng);
});

function generate() {
  const storedPlayerCoins = localStorage.getItem("playerCoins");
  playerCoins = storedPlayerCoins
    ? (JSON.parse(storedPlayerCoins) as Coin[])
    : [];

  cacheLayers.clearLayers();
  map.setView(playerMarker.getLatLng());
  const currentCells = board.getCellsNearPoint(playerMarker.getLatLng());

  for (const cell of currentCells) {
    if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
      makeCache(cell.i, cell.j);
    }
  }
}

navigator.geolocation.getCurrentPosition((position) => {
  path.newPoly();
  const latLng = leaflet.latLng(
    position.coords.latitude,
    position.coords.longitude
  );
  movePlayer(latLng);
  navigator.geolocation.watchPosition((position) => {
    const latLng = leaflet.latLng(
      position.coords.latitude,
      position.coords.longitude
    );
    movePlayer(latLng);
  });
});

movePlayer(NULL_ISLAND);
generate();
