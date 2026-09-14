import { input } from "../state/inputState.js";
import { emit } from "../state/gameBus.js";

export class KeyboardControls {
  constructor() {
    this.left = false;
    this.right = false;
    this._onDown = this._onDown.bind(this);
    this._onUp = this._onUp.bind(this);
    window.addEventListener("keydown", this._onDown);
    window.addEventListener("keyup", this._onUp);
  }

  _applySteer() {
    input.steer = (this.right ? 1 : 0) - (this.left ? 1 : 0);
  }

  _onDown(e) {
    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        input.throttle = 1;
        break;
      case "ArrowDown":
      case "KeyS":
        input.brake = 1;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.left = true;
        this._applySteer();
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = true;
        this._applySteer();
        break;
      case "KeyR":
        input.reverse = 1;
        break;
      case "Space":
        input.handbrake = true;
        e.preventDefault();
        break;
      case "KeyC":
        emit("cameraCycle");
        break;
      case "KeyV":
        emit("toggleInterior");
        break;
      case "KeyL":
        emit("toggleLights");
        break;
      case "KeyH":
        emit("toggleHazard");
        break;
      case "KeyQ":
        emit("blinkLeft");
        break;
      case "KeyE":
        emit("blinkRight");
        break;
      case "KeyM":
        emit("openMap");
        break;
      default:
        break;
    }
  }

  _onUp(e) {
    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        input.throttle = 0;
        break;
      case "ArrowDown":
      case "KeyS":
        input.brake = 0;
        break;
      case "ArrowLeft":
      case "KeyA":
        this.left = false;
        this._applySteer();
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = false;
        this._applySteer();
        break;
      case "KeyR":
        input.reverse = 0;
        break;
      case "Space":
        input.handbrake = false;
        break;
      default:
        break;
    }
  }

  dispose() {
    window.removeEventListener("keydown", this._onDown);
    window.removeEventListener("keyup", this._onUp);
  }
}
