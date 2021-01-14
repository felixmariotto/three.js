import {
	EventDispatcher,
	Vector2
} from '../../../build/three.module.js';

const ImmersiveControls = function ( object, renderer ) {

	this.object = object;
	this.domElement = renderer.domElement;

	// API

	this.enabled = true;
	this.direction = new Vector2();

	// INTERNALS

	const scope = this;

	const viewHalfSize = new Vector2();
	const mouse = new Vector2();

	const keyDirVector = new Vector2();
	const axesDirVector = new Vector2();

	const keysDirection = {
		up: false,
		down: false,
		right: false,
		left: false
	};

	// XR INPUT

	const inputs = [];

	for ( let i=0 ; i<2 ; i++ ) {

		let input = {
			inputGroup: renderer.xr.getController( i )
		};

		inputs.push( input );

		input.inputGroup.addEventListener( 'selectend', (e) => {
			console.log('test', e)
		})

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

		}

		// fireKeyDown( { inputProfile: 'keyboard' } );

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

		}

		// fireKeyUp( { inputProfile: 'keyboard' } );

	}

	function computeKeyboardDir () {

		keyDirVector.y = ( keysDirection.up ? 1 : 0 ) + ( keysDirection.down ? -1 : 0 );
		keyDirVector.x = ( keysDirection.right ? 1 : 0 ) + ( keysDirection.left ? -1 : 0 );
		keyDirVector.normalize();

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

		if ( this.domElement === document ) {

			viewHalfSize.x = window.innerWidth;
			viewHalfSize.z = window.innerHeight;

		} else {

			viewHalfSize.x = this.domElement.offsetWidth;
			viewHalfSize.z = this.domElement.offsetHeight;

		}

	};

	//

	this.update = function ( deltaTime ) {

		inputs.forEach( input => input.checkState() );

	}

};

ImmersiveControls.prototype = Object.create( EventDispatcher.prototype );
ImmersiveControls.prototype.constructor = ImmersiveControls;

export { ImmersiveControls };
