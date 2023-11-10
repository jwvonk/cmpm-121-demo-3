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
    return `id${this.i}_${this.j}_${this.serial}`;
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

  function hideCoinHTML(elem: HTMLDivElement, coin: Coin) {
    elem.querySelector<HTMLLIElement>(`#${coin.id}`)!.classList.add("hidden");
  }

  function revealCoinHTML(elem: HTMLDivElement, coin: Coin) {
    elem
      .querySelector<HTMLLIElement>(`#${coin.id}`)!
      .classList.remove("hidden");
  }

  geoCache.bindPopup(() => {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.alignContent = "space-around";
    container.innerHTML += `<ul id="playerCoins">(Player Coins)</ul><hr><ul id="cacheCoins">(Cache Coins)</ul>`;

    const playerCoinsElem =
      container.querySelector<HTMLDivElement>("#playerCoins")!;
    const cacheCoinsElem =
      container.querySelector<HTMLDivElement>("#cacheCoins")!;

    const allCoins = playerCoins.concat(cacheCoins);

    for (const coin of allCoins) {
      playerCoinsElem.innerHTML += `<li id=${coin.id}><span>${coin.displayText}</span><button id=${coin.id}>></button></li>`;
      cacheCoinsElem.innerHTML += `<li id=${coin.id}><button id=${coin.id}><</button><span>\t${coin.displayText}</span></li>`;
    }

    for (const coin of playerCoins) {
      hideCoinHTML(cacheCoinsElem, coin);
    }

    for (const coin of cacheCoins) {
      hideCoinHTML(playerCoinsElem, coin);
    }

    for (const coin of allCoins) {
      let button = playerCoinsElem.querySelector<HTMLButtonElement>(
        `#${coin.id}`
      )!;
      button.addEventListener("click", () => {
        cacheCoins.push(playerCoins.splice(playerCoins.indexOf(coin), 1)[0]);
        hideCoinHTML(playerCoinsElem, coin);
        revealCoinHTML(cacheCoinsElem, coin);
      });

      button = cacheCoinsElem.querySelector<HTMLButtonElement>(`#${coin.id}`)!;
      button.addEventListener("click", () => {
        playerCoins.push(cacheCoins.splice(cacheCoins.indexOf(coin), 1)[0]);
        hideCoinHTML(cacheCoinsElem, coin);
        revealCoinHTML(playerCoinsElem, coin);
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
