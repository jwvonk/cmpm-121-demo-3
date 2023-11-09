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

const playerMarker = leaflet.marker(NULL_ISLAND);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
});

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

class Coin {
  readonly i: number;
  readonly j: number;
  readonly serial: number;

  constructor(i: number, j: number, serial: number) {
    this.i = i;
    this.j = j;
    this.serial = serial;
  }

  get displayText() {
    return `${this.i}:${this.j}#${this.serial}`;
  }

  get id() {
    return `b${this.i}_${this.j}_${this.serial}`;
  }
}

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

const playerCoins: Coin[] = [];

const cacheCoinRegistry = new Map<string, Coin[]>();

function makeCache(i: number, j: number) {
  const bounds = board.getCellBounds({ i, j });

  const geoCache = leaflet.rectangle(bounds) as leaflet.Layer;

  const cacheKey = `${i},${j}`;
  let cacheCoins: Coin[];
  if (!cacheCoinRegistry.has(cacheKey)) {
    cacheCoins = new Array<Coin>(
      Math.floor(luck([i, j, "initialValue"].toString()) * 100)
    );
    for (let serial = 0; serial < cacheCoins.length; serial++) {
      cacheCoins[serial] = new Coin(i, j, serial);
    }
    cacheCoinRegistry.set(cacheKey, cacheCoins);
  } else {
    cacheCoins = cacheCoinRegistry.get(cacheKey)!;
  }

  geoCache.bindPopup(() => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.innerHTML += `<div id="playerCoins">(Player Coins)<br></div><hr><div id="cacheCoins">(Cache Coins)<br></div>`;

    const playerCoinsElem =
      container.querySelector<HTMLDivElement>("#playerCoins")!;
    for (const coin of playerCoins) {
      playerCoinsElem.innerHTML += `<div>${coin.displayText} <button id=${coin.id}>></button><br></div>`;
    }

    const cacheCoinsElem =
      container.querySelector<HTMLDivElement>("#cacheCoins")!;
    for (const coin of cacheCoins) {
      cacheCoinsElem.innerHTML += `<div><button id=${coin.id}><</button> ${coin.displayText}<br></div>`;
    }

    for (let i = 0; i < playerCoins.length; i++) {
      const button = playerCoinsElem.querySelector<HTMLButtonElement>(
        `#${playerCoins[i].id}`
      )!;
      button.addEventListener("click", () => {
        cacheCoins.push(playerCoins.splice(i, 1)[0]);
        button.parentElement!.remove();
      });
    }

    for (let i = 0; i < cacheCoins.length; i++) {
      const button = cacheCoinsElem.querySelector<HTMLButtonElement>(
        `#${cacheCoins[i].id}`
      )!;
      button.addEventListener("click", () => {
        playerCoins.push(cacheCoins.splice(i, 1)[0]);
        button.parentElement!.remove();
      });
    }

    return container;
  });
  geoCache.addTo(map);
}

const currentCells = board.getCellsNearPoint(NULL_ISLAND);

for (const cell of currentCells) {
  if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
    makeCache(cell.i, cell.j);
  }
}
