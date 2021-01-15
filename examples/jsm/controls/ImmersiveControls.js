import {
	EventDispatcher,
	Vector2,
	Vector3,
	Group
} from '../../../build/three.module.js';

const ImmersiveControls = function ( camera, renderer ) {

	// this.camera = camera;
	this.domElement = renderer.domElement;

	// API

	this.enabled = true;
	this.direction = new Vector2();
	this.viewDirection = camera.getWorldDirection( new Vector3() );
	this.viewerSpace = new Group();

	this.viewerSpace.add( camera );
	camera.position.y = 1.5;

	// INTERNALS

	const scope = this;

	const domElemSize = new Vector2();
	const mouse = new Vector2();

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

		let input = {
			inputGroup: renderer.xr.getController( i )
		};

		xrInputs.push( input );

		input.inputGroup.addEventListener( 'connected', (e) => {

			// https://www.w3.org/TR/webxr/#xrinputsource-interface
			input.inputSource = e.data;

			input.gamepad = e.data.gamepad;

			input.hand = e.data.hand;

			input.handedness = e.data.handedness;

		} );

		input.inputGroup.addEventListener( 'disconnected', () => {

			input.inputSource = null;

			input.gamepad = null;

			input.hand = null;

			input.handedness = null;

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

					fireDirectionChange( { inputProfile: 'controller' } );

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

						fireKeyDown( {
							handedness: this.handedness,
							inputProfile: 'controller'
						} );

					} else {

						fireKeyUp( {
							handedness: this.handedness,
							inputProfile: 'controller'
						} );

					}

					const oldButton = this.gamepad.oldState.buttons[ this.gamepad.buttons.indexOf( changedBtn ) ];

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

			// WASD/Arrows update the direction and fires a 'directionchange' event

			case 'ArrowUp':
			case 'KeyW':
				keysDirection.up = true;
				computeKeyboardDir();
				fireDirectionChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowLeft':
			case 'KeyA':
				keysDirection.left = true;
				computeKeyboardDir();
				fireDirectionChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowDown':
			case 'KeyS':
				keysDirection.down = true;
				computeKeyboardDir();
				fireDirectionChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowRight':
			case 'KeyD':
				keysDirection.right = true;
				computeKeyboardDir();
				fireDirectionChange( { inputProfile: 'keyboard' } );
				break;

			// Enter and Space keys emulate controllers buttons

			case 'Enter':
			case 'Space':
				fireKeyDown( { inputProfile: 'keyboard' } );
				break;

		}

	}

	function onKeyboardKeyUp ( event ) {

		switch ( event.code ) {

			// WASD/Arrows update the direction and fires a 'directionchange' event

			case 'ArrowUp':
			case 'KeyW':
				keysDirection.up = false;
				computeKeyboardDir();
				fireDirectionChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowLeft':
			case 'KeyA':
				keysDirection.left = false;
				computeKeyboardDir();
				fireDirectionChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowDown':
			case 'KeyS':
				keysDirection.down = false;
				computeKeyboardDir();
				fireDirectionChange( { inputProfile: 'keyboard' } );
				break;

			case 'ArrowRight':
			case 'KeyD':
				keysDirection.right = false;
				computeKeyboardDir();
				fireDirectionChange( { inputProfile: 'keyboard' } );
				break;

			// Enter and Space keys emulate controllers buttons

			case 'Enter':
			case 'Space':
				fireKeyUp( { inputProfile: 'keyboard' } );
				break;

		}

	}

	function computeKeyboardDir () {

		keyDirVector.y = ( keysDirection.up ? 1 : 0 ) + ( keysDirection.down ? -1 : 0 );
		keyDirVector.x = ( keysDirection.right ? 1 : 0 ) + ( keysDirection.left ? -1 : 0 );
		keyDirVector.normalize();

	}

	// MOUSE INPUT

	window.addEventListener( 'mousemove', onMouseMove );

	function onMouseMove ( event ) {

		mouse.x = event.pageX - scope.domElement.offsetLeft - domElemSize.x;
		mouse.y = event.pageY - scope.domElement.offsetTop - domElemSize.y;

		mouse.x = ( mouse.x / domElemSize.x ) * 2 + 1;
		mouse.y = ( mouse.y / domElemSize.y ) * -2 - 1;

	}

	// EVENTS

	function fireKeyDown ( parameters ) {

		const event = Object.assign( {
			type: 'keydown'
		}, parameters );

		scope.dispatchEvent( event );

	}

	function fireKeyUp ( parameters ) {

		const event = Object.assign( {
			type: 'keyup'
		}, parameters );

		scope.dispatchEvent( event );

	}

	function fireDirectionChange ( parameters ) {

		// compute the ImmersiveControls.direction, that the user wants to read.

		scope.direction.copy( keyDirVector );
		scope.direction.add( axesDirVector );

		// fire the event

		const event = Object.assign( {
			type: 'directionchange'
		}, parameters );

		scope.dispatchEvent( event );

	}

	// MISC

	this.handleResize = function () {

		domElemSize.x = this.domElement.offsetWidth;
		domElemSize.y = this.domElement.offsetHeight;

	};

	//

	const cross = new Vector3();

	this.update = function ( deltaTime ) {

		xrInputs.forEach( input => input.checkState() );

		if ( xrSession ) {

			const arrayCamera = renderer.xr.getCamera( camera );

			arrayCamera.getWorldDirection( this.viewDirection );

			this.viewDirection.normalize();

		} else {

			// update viewDirection according to mouse position on dom element

			cross.crossVectors( this.viewDirection, camera.up );
			cross.normalize();

			this.viewDirection.addScaledVector( cross, Math.pow( mouse.x, 3 ) * 0.045 );

			cross.crossVectors( cross, this.viewDirection );

			this.viewDirection.addScaledVector( cross, Math.pow( mouse.y, 3 ) * 0.045 );

			this.viewDirection.normalize();

			// clamp to avoid antipodal points up and down the camera

			this.viewDirection.y = Math.min( 0.8, Math.max( -0.8, this.viewDirection.y ) );

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
