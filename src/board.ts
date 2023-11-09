import leaflet from "leaflet";

interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;

    this.knownCells = new Map<string, Cell>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();

    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, { i, j });
    }

    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    return this.getCanonicalCell({
      i: Math.round(point.lat / this.tileWidth),
      j: Math.round(point.lng / this.tileWidth),
    });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const sw = leaflet.latLng(cell.i * this.tileWidth, cell.j * this.tileWidth);
    const ne = leaflet.latLng(
      (cell.i + 1) * this.tileWidth,
      (cell.j + 1) * this.tileWidth
    );
    return leaflet.latLngBounds(sw, ne);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    for (
      let x = -this.tileVisibilityRadius;
      x < this.tileVisibilityRadius;
      x++
    ) {
      for (
        let y = -this.tileVisibilityRadius;
        y < this.tileVisibilityRadius;
        y++
      ) {
        const i = originCell.i + x;
        const j = originCell.j + y;
        resultCells.push(this.getCanonicalCell({ i, j }));
      }
    }
    return resultCells;
  }
}
