import {
	EventDispatcher,
	Vector2,
	Vector3,
	Group
} from '../../../build/three.module.js';
import { XRControllerModelFactory } from '../webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from '../webxr/XRHandModelFactory.js';

const ImmersiveControls = function ( camera, renderer ) {

	// this.camera = camera;
	this.domElement = renderer.domElement;

	// API

	this.enabled = true;
	this.mouseMovePower = 0.45;
	this.mouseClamp = 0.8;
	this.axes = new Vector2();
	this.viewDirection = camera.getWorldDirection( new Vector3() );

	// INTERNALS

	const scope = this;

	const domElemSize = new Vector2();
	const mouse = new Vector2();
	const crossVec = new Vector3();

	const controllerModelFactory = new XRControllerModelFactory();

	const keyDirVector = new Vector2();
	const axesDirVector = new Vector2();

	const keysDirection = {
		up: false,
		down: false,
		right: false,
		left: false
	};

	let xrSession;
	// let referenceSpace;

	renderer.xr.addEventListener( 'sessionstart', (e) => {

		xrSession = renderer.xr.getSession();
		// referenceSpace = renderer.xr.getReferenceSpace()

	});

	renderer.xr.addEventListener( 'sessionend', (e) => {

		xrSession = null;

	});

	// XR INPUT

	const xrInputs = [];

	for ( let i=0 ; i<2 ; i++ ) {

		const input = {};

		xrInputs.push( input );

		input.handleEvent = function ( event, eventName ) {

			if ( event.inputSource == this.inputSource ) {

				fireEvent( {
					type: eventName,
					handedness: this.handedness,
					inputProfile: 'controller'
				} );

			}

		}

		input.setupSource = function ( inputSource ) {

			this.inputSource = inputSource;
			this.gamepad = inputSource.gamepad;
			this.hand = inputSource.hand;
			this.handedness = inputSource.handedness;

			xrSession.addEventListener( 'select', ( event ) => {
				this.handleEvent( event, 'click' );
			} );

			xrSession.addEventListener( 'selectstart', ( event ) => {
				this.handleEvent( event, 'clickstart' );
			} );

			xrSession.addEventListener( 'selectend', ( event ) => {
				this.handleEvent( event, 'clickend' );
			} );

		}

		input.removeSource = function () {

			this.inputSource = null;
			this.gamepad = null;
			this.hand = null;
			this.handedness = null;

		}

		input.rayGroup = renderer.xr.getController( i );
		input.gripGroup = renderer.xr.getControllerGrip( i );

		input.gripGroup.add( controllerModelFactory.createControllerModel( input.gripGroup ) );

		input.rayGroup.addEventListener( 'connected', (e) => {

			input.setupSource( e.data );

		} );

		input.rayGroup.addEventListener( 'disconnected', () => {

			input.removeSource();

		} );

		input.checkState = function () {

			if ( this.gamepad ) {

				// create reference old state in this.gamepad for comparison with new state

				if ( !this.gamepad.oldState ) {

					this.gamepad.oldState = {
						axes: this.gamepad.axes.slice(0),
						buttons: this.gamepad.buttons.map( (btn) => {
							return {
								pressed: btn.pressed
								/* to add later maybe :
								touched: btn.touched
								value: btn.value
								*/
							}
						} )
					};

				}

				// compare old axes state with current state

				if (
					this.gamepad.oldState.axes[ 0 ] !== this.gamepad.axes[ 0 ] ||
					this.gamepad.oldState.axes[ 1 ] !== this.gamepad.axes[ 1 ] ||
					this.gamepad.oldState.axes[ 2 ] !== this.gamepad.axes[ 2 ] ||
					this.gamepad.oldState.axes[ 3 ] !== this.gamepad.axes[ 3 ]
				) {

					axesDirVector.x = this.gamepad.axes[2];
					axesDirVector.y = this.gamepad.axes[3] * -1;

					fireAxesChange( { inputProfile: 'controller' } );

					this.gamepad.oldState.axes[ 0 ] = this.gamepad.axes[ 0 ];
					this.gamepad.oldState.axes[ 1 ] = this.gamepad.axes[ 1 ];
					this.gamepad.oldState.axes[ 2 ] = this.gamepad.axes[ 2 ];
					this.gamepad.oldState.axes[ 3 ] = this.gamepad.axes[ 3 ];

				}

				// compare old buttons state with current state

				const changedBtns = this.gamepad.buttons.filter( (btn, i) => {

					return btn.pressed !== this.gamepad.oldState.buttons[ i ].pressed

				} );

				changedBtns.forEach( (changedBtn) => {

					if ( changedBtn.pressed ) {

						fireEvent( {
							type: 'keydown',
							inputProfile: 'controller',
							handedness: this.handedness
						} );

					} else {

						fireEvent( {
							type: 'keyup',
							inputProfile: 'controller',
							handedness: this.handedness
						} );

					}

					const idx = this.gamepad.buttons.indexOf( changedBtn );

					const oldButton = this.gamepad.oldState.buttons[ idx ];

					oldButton.pressed = changedBtn.pressed;

				});

			}

			if ( this.hand ) console.log( 'check my hand' );

		}

	}

	// KEYBOARD INPUT

	window.addEventListener( 'keydown', onKeyboardKeyDown, false );
	window.addEventListener( 'keyup', onKeyboardKeyUp, false );

	function onKeyboardKeyDown ( event ) {

		switch ( event.code ) {

			// WASD/Arrows update the axes and fires a 'axeschange' event

			case 'ArrowUp':
			case 'KeyW':
				keysDirection.up = true;
				computeKeyboardDir();
				fireAxesChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowLeft':
			case 'KeyA':
				keysDirection.left = true;
				computeKeyboardDir();
				fireAxesChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowDown':
			case 'KeyS':
				keysDirection.down = true;
				computeKeyboardDir();
				fireAxesChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowRight':
			case 'KeyD':
				keysDirection.right = true;
				computeKeyboardDir();
				fireAxesChange( { inputProfile: 'keyboard' } );
				break;

			// Enter and Space keys emulate controllers buttons

			case 'Enter':
			case 'Space':
				fireEvent( {
					type: 'keydown',
					inputProfile: 'keyboard'
				} );
				break;

		}

	}

	function onKeyboardKeyUp ( event ) {

		switch ( event.code ) {

			// WASD/Arrows update the axes and fires a 'axeschange' event

			case 'ArrowUp':
			case 'KeyW':
				keysDirection.up = false;
				computeKeyboardDir();
				fireAxesChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowLeft':
			case 'KeyA':
				keysDirection.left = false;
				computeKeyboardDir();
				fireAxesChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowDown':
			case 'KeyS':
				keysDirection.down = false;
				computeKeyboardDir();
				fireAxesChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowRight':
			case 'KeyD':
				keysDirection.right = false;
				computeKeyboardDir();
				fireAxesChange( { inputProfile: 'keyboard' } );
				break;

			// Enter and Space keys emulate controllers buttons

			case 'Enter':
			case 'Space':
				fireEvent( {
					type: 'keyup',
					inputProfile: 'keyboard'
				} );
				break;

		}

	}

	function computeKeyboardDir () {

		keyDirVector.y = ( keysDirection.up ? 1 : 0 ) + ( keysDirection.down ? -1 : 0 );
		keyDirVector.x = ( keysDirection.right ? 1 : 0 ) + ( keysDirection.left ? -1 : 0 );
		keyDirVector.normalize();

	}

	// POINTER INPUT

	window.addEventListener( 'pointermove', onPointerMove );
	window.addEventListener( 'click', onMouseClick );
	window.addEventListener( 'pointerdown', onPointerDown );
	window.addEventListener( 'pointerup', onPointerUp );

	function onPointerMove ( event ) {

		mouse.x = event.pageX - scope.domElement.offsetLeft - domElemSize.x;
		mouse.y = event.pageY - scope.domElement.offsetTop - domElemSize.y;

		mouse.x = ( mouse.x / domElemSize.x ) * 2 + 1;
		mouse.y = ( mouse.y / domElemSize.y ) * -2 - 1;

	}

	function onMouseClick ( event ) {

		fireEvent( {
			type: 'click',
			inputProfile: 'pointer'
		} );

	}

	function onPointerDown ( event ) {

		fireEvent( {
			type: 'clickstart',
			inputProfile: 'pointer'
		} );

	}

	function onPointerUp ( event ) {

		fireEvent( {
			type: 'clickend',
			inputProfile: 'pointer'
		} );

	}

	// STANDARD EVENTS

	function fireEvent( eventParams ) {

		if ( !eventParams.handedness ) eventParams.handedness = null;

		scope.dispatchEvent( eventParams );

	}

	function fireAxesChange ( eventParams ) {

		// compute the ImmersiveControls.axes, that the user wants to read.

		scope.axes.copy( keyDirVector );
		scope.axes.add( axesDirVector );

		// fire the event

		eventParams.type = 'axeschange';

		scope.dispatchEvent( eventParams );

	}

	// MISC

	this.setViewerSpace = ( group ) => {

		this.viewerSpace = group;
		this.viewerSpace.add( camera );
		camera.position.y = 1.5;

		xrInputs.forEach( (input) => {

			this.viewerSpace.add( input.rayGroup, input.gripGroup );

		} );

	}

	this.setViewerSpace( new Group() );

	this.handleResize = function () {

		domElemSize.x = this.domElement.offsetWidth;
		domElemSize.y = this.domElement.offsetHeight;

	};

	//

	this.update = function ( deltaTime ) {

		xrInputs.forEach( input => input.checkState() );

		if ( xrSession ) {

			const arrayCamera = renderer.xr.getCamera( camera );

			arrayCamera.getWorldDirection( this.viewDirection );

			this.viewDirection.normalize();

		} else {

			// update viewDirection according to mouse position on dom element

			crossVec.crossVectors( this.viewDirection, camera.up );
			crossVec.normalize();

			this.viewDirection.addScaledVector( crossVec, Math.pow( mouse.x, 3 ) * this.mouseMovePower * 0.1 );

			crossVec.crossVectors( crossVec, this.viewDirection );

			this.viewDirection.addScaledVector( crossVec, Math.pow( mouse.y, 3 ) * this.mouseMovePower * 0.1 );

			this.viewDirection.normalize();

			// clamp to avoid antipodal points up and down the camera

			this.viewDirection.y = Math.min( this.mouseClamp, Math.max( -this.mouseClamp, this.viewDirection.y ) );

			this.viewDirection.normalize();

			// rotate camera

			this.viewerSpace.localToWorld( this.viewDirection );
			this.viewDirection.add( camera.position );

			camera.lookAt( this.viewDirection );

			this.viewDirection.sub( camera.position );
			this.viewerSpace.worldToLocal( this.viewDirection );

		}

	}

	//

	this.handleResize();

};

ImmersiveControls.prototype = Object.create( EventDispatcher.prototype );
ImmersiveControls.prototype.constructor = ImmersiveControls;

export { ImmersiveControls };
