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
    generate();
  });
});

const northButton = document.querySelector("#north")!;
northButton.addEventListener("click", () => {
  const current = playerMarker.getLatLng();
  playerMarker.setLatLng(
    leaflet.latLng(current.lat + TILE_DEGREES, current.lng)
  );
  generate();
});

const southButton = document.querySelector("#south")!;
southButton.addEventListener("click", () => {
  const current = playerMarker.getLatLng();
  playerMarker.setLatLng(
    leaflet.latLng(current.lat - TILE_DEGREES, current.lng)
  );
  generate();
});

const eastButton = document.querySelector("#east")!;
eastButton.addEventListener("click", () => {
  const current = playerMarker.getLatLng();
  playerMarker.setLatLng(
    leaflet.latLng(current.lat, current.lng + TILE_DEGREES)
  );
  generate();
});

const westButton = document.querySelector("#west")!;
westButton.addEventListener("click", () => {
  const current = playerMarker.getLatLng();
  playerMarker.setLatLng(
    leaflet.latLng(current.lat, current.lng - TILE_DEGREES)
  );
  generate();
});

interface Coin {
  readonly i: number;
  readonly j: number;
  readonly serial: number;
}

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

const playerCoins: Coin[] = [];

const cacheMomentos = new Map<string, string>();

const cahceLayers = leaflet.layerGroup().addTo(map);

function makeCache(i: number, j: number) {
  const bounds = board.getCellBounds({ i, j });

  const cacheLayer = leaflet.rectangle(bounds) as leaflet.Layer;

  const cache = new Geocache(i, j);

  if (!cacheMomentos.has(cache.momentoKey)) {
    cache.gennerateCoins();
    cacheMomentos.set(cache.momentoKey, cache.toMomento());
  } else {
    cache.fromMomento(cacheMomentos.get(cache.momentoKey)!);
  }

  function displayText(coin: Coin) {
    return `${coin.i}:${coin.j}#${coin.serial}`;
  }

  function id(coin: Coin) {
    return `id${coin.i}_${coin.j}_${coin.serial}`;
  }

  function hideCoinHTML(elem: HTMLDivElement, coin: Coin) {
    elem.querySelector<HTMLLIElement>(`#${id(coin)}`)!.classList.add("hidden");
  }

  function revealCoinHTML(elem: HTMLDivElement, coin: Coin) {
    elem
      .querySelector<HTMLLIElement>(`#${id(coin)}`)!
      .classList.remove("hidden");
  }

  cacheLayer.bindPopup(
    () => {
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.alignContent = "space-around";
      container.innerHTML += `<ul id="playerCoins">(Player Coins)</ul><hr><ul id="cacheCoins">(Cache Coins)</ul>`;

      const playerCoinsElem =
        container.querySelector<HTMLDivElement>("#playerCoins")!;
      const cacheCoinsElem =
        container.querySelector<HTMLDivElement>("#cacheCoins")!;

      const allCoins = playerCoins.concat(cache.coins);

      for (const coin of allCoins) {
        playerCoinsElem.innerHTML += `<li id=${id(coin)}><span>${displayText(
          coin
        )}\t</span><button id=${id(coin)}>></button></li>`;
        cacheCoinsElem.innerHTML += `<li id=${id(coin)}><button id=${id(
          coin
        )}><</button><span>\t${displayText(coin)}</span></li>`;
      }

      for (const coin of playerCoins) {
        hideCoinHTML(cacheCoinsElem, coin);
      }

      for (const coin of cache.coins) {
        hideCoinHTML(playerCoinsElem, coin);
      }

      for (const coin of allCoins) {
        let button = playerCoinsElem.querySelector<HTMLButtonElement>(
          `#${id(coin)}`
        )!;
        button.addEventListener("click", () => {
          cache.coins.push(playerCoins.splice(playerCoins.indexOf(coin), 1)[0]);
          cacheMomentos.set(cache.momentoKey, cache.toMomento());
          hideCoinHTML(playerCoinsElem, coin);
          revealCoinHTML(cacheCoinsElem, coin);
        });

        button = cacheCoinsElem.querySelector<HTMLButtonElement>(
          `#${id(coin)}`
        )!;
        button.addEventListener("click", () => {
          playerCoins.push(cache.coins.splice(cache.coins.indexOf(coin), 1)[0]);
          cacheMomentos.set(cache.momentoKey, cache.toMomento());
          hideCoinHTML(cacheCoinsElem, coin);
          revealCoinHTML(playerCoinsElem, coin);
        });
      }
      return container;
    },
    { maxWidth: 500 }
  );
  cahceLayers.addLayer(cacheLayer);
}

function generate() {
  cahceLayers.clearLayers();
  map.setView(playerMarker.getLatLng());
  const currentCells = board.getCellsNearPoint(playerMarker.getLatLng());

  for (const cell of currentCells) {
    if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
      makeCache(cell.i, cell.j);
    }
  }
}

generate();
