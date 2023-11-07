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

let coins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

const pitValues: Record<string, number> = {};

function makePit(i: number, j: number) {
  const currentPos = playerMarker.getLatLng();
  const bounds = leaflet.latLngBounds([
    [currentPos.lat + i * TILE_DEGREES, currentPos.lng + j * TILE_DEGREES],
    [
      currentPos.lat + (i + 1) * TILE_DEGREES,
      currentPos.lng + (j + 1) * TILE_DEGREES,
    ],
  ]);

  const pit = leaflet.rectangle(bounds) as leaflet.Layer;

  const pitKey = `${i}_${j}`;
  if (!pitValues[pitKey]) {
    pitValues[pitKey] = Math.floor(
      luck([i, j, "initialValue"].toString()) * 100
    );
  }

  pit.bindPopup(() => {
    let value = pitValues[pitKey];
    const container = document.createElement("div");
    container.innerHTML = `
                <div>There is a pit here at "${i},${j}". It has <span id="value">${value}</span> coins.</div>
                <button id="collect">collect</button>
                <button id="deposit">deposit</button>`;
    const collect = container.querySelector<HTMLButtonElement>("#collect")!;
    collect.addEventListener("click", () => {
      if (value > 0) {
        value--;
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          value.toString();
        pitValues[pitKey] = value;
        coins++;
        statusPanel.innerHTML = `${coins} coins accumulated`;
      }
    });
    const deposit = container.querySelector<HTMLButtonElement>("#deposit")!;
    deposit.addEventListener("click", () => {
      if (coins > 0) {
        value++;
        container.querySelector<HTMLSpanElement>("#value")!.innerHTML =
          value.toString();
        pitValues[pitKey] = value;
        coins--;
        statusPanel.innerHTML = `${coins} coins accumulated`;
      }
    });
    return container;
  });
  pit.addTo(map);
}

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

const currentCells = board.getCellsNearPoint(NULL_ISLAND);

for (const cell of currentCells) {
  if (luck([cell.i, cell.j].toString()) < PIT_SPAWN_PROBABILITY) {
    makePit(cell.i, cell.j);
  }
}

// for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
//   for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
//     if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
//       makePit(i, j);
//     }
//   }
// }
