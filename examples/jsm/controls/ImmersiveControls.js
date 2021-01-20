import {
	EventDispatcher,
	Color,
	Vector2,
	Vector3,
	Group,
	Line,
	Mesh,
	LineBasicMaterial,
	MeshBasicMaterial,
	LatheBufferGeometry,
	BufferGeometry,
	BufferAttribute,
	Raycaster
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
	this.arcControlPointDist = 1.5;
	this.arcTension = 0.5;
	this.axes = new Vector2();
	this.arcColor = new Color( 0xff56f5 );
	this.viewDirection = camera.getWorldDirection( new Vector3() );
	this.arcMaterial = new LineBasicMaterial( { color: this.arcColor } );

	// INTERNALS

	const scope = this;
	const arcVerts = 20;
	const raycaster = new Raycaster();

	const domElemSize = new Vector2();
	const mouse = new Vector2();
	const vec1 = new Vector3();
	const vec2 = new Vector3();
	const vec3 = new Vector3();

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

	this.xrInputs = [];

	for ( let i=0 ; i<2 ; i++ ) {

		const input = {};

		this.xrInputs.push( input );

		// get controller spaces + add controller mesh

		input.rayGroup = renderer.xr.getController( i );
		input.gripGroup = renderer.xr.getControllerGrip( i );

		input.gripGroup.add( controllerModelFactory.createControllerModel( input.gripGroup ) );

		// arc pointer

		input.arcGeometry = new BufferGeometry();
		input.arc = new Line( input.arcGeometry, this.arcMaterial );
		input.arcGeometry.setAttribute( 'position', new BufferAttribute( new Float32Array( 3 * arcVerts ), 3 ) );

		input.arcVecOrg = new Vector3(); 
		input.arcVecMid = new Vector3();
		input.arcVecEnd = new Vector3();

		const lathePoints = [ new Vector2( 0.4, 0 ), new Vector2( 0.3, 0 ) ];
		const latheGeom = new LatheBufferGeometry( lathePoints, 32 );

		input.arcCursor = new Mesh(
			latheGeom,
			new MeshBasicMaterial( { color: scope.arcColor } )
		);

		input.arcCursor.geometry.rotateX( Math.PI / 2 );

		input.updateArc = function () {

			if ( this.rayGroup ) this.rayGroup.add( input.arc );

			// get handles of bezier curve

			this.arcVecOrg.set( 0, 0, 0 );
			this.arcVecMid.set( 0, 0, scope.arcControlPointDist * -1 );
			this.arcVecEnd.set( 0, 0, scope.arcControlPointDist * -3 );

			// move the end of the curve according to projection direction

			this.rayGroup.localToWorld( this.arcVecOrg );
			this.rayGroup.localToWorld( this.arcVecMid );
			this.rayGroup.localToWorld( this.arcVecEnd );

			const dotUp = vec1
			.copy( this.arcVecMid )
			.sub( this.arcVecOrg )
			.normalize()
			.dot( camera.up );

			// we got the dot from up vector, we tween it with the user-defined ImmersiveControls.arcTension
			// and reduce the end handle height proportionally with the middle handle length.
			this.arcVecEnd.y -= ( scope.arcControlPointDist * 5 ) * Math.pow( dotUp * 0.5 + 0.5, scope.arcTension * 3 + 1 );

			raycaster.ray.origin.copy( this.arcVecMid );
			raycaster.ray.direction
			.copy( this.arcVecEnd )
			.sub( this.arcVecMid )
			.normalize();

			this.rayGroup.worldToLocal( this.arcVecOrg );
			this.rayGroup.worldToLocal( this.arcVecMid );
			this.rayGroup.worldToLocal( this.arcVecEnd );

			// update geometry and cast rays

			const posAttrib = this.arcGeometry.attributes.position;

			let firstIntersect;

			for ( let i=0 ; i<arcVerts ; i++ ) {

				// bezier curve sampling to update arc geometry

				const a = i / ( arcVerts - 1 );
				vec1.lerpVectors( this.arcVecOrg, this.arcVecMid, a );
				vec2.lerpVectors( this.arcVecMid, this.arcVecEnd, a );
				vec3.lerpVectors( vec1, vec2, a );

				posAttrib.setXYZ( i, vec3.x, vec3.y, vec3.z );

			}

			posAttrib.needsUpdate = true;

			// find intersection

			const intersects = raycaster.intersectObject( scope.navigationObject, true );

			if ( intersects.length ) {

				scope.viewerSpace.add( this.arcCursor );

				this.arcCursor.position.copy( intersects[0].point );
				this.arcCursor.position.addScaledVector( intersects[0].face.normal, 0.02 );
				scope.viewerSpace.worldToLocal( this.arcCursor.position );

				vec1.copy( intersects[0].point );
				vec1.add( intersects[0].face.normal );

				this.arcCursor.lookAt( vec1 );

			} else {

				scope.viewerSpace.remove( this.arcCursor );

			}	

		}

		// vr controller setup

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

					// we check that the pressed button is not the primary controller button,
					// because this button must only fire select events.

					// https://immersive-web.github.io/webxr-gamepads-module/#xr-standard-gamepad-mapping
					if (
						this.gamepad.mapping === "xr-standard" &&
						changedBtn === this.gamepad.buttons[0]
					) {
						return
					}

					// fire keyup or keydown event

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

		this.xrInputs.forEach( (input) => {

			this.viewerSpace.add( input.rayGroup, input.gripGroup );

		} );

	}

	this.handleResize = function () {

		domElemSize.x = this.domElement.offsetWidth;
		domElemSize.y = this.domElement.offsetHeight;

	};

	//

	this.update = function ( deltaTime ) {

		this.xrInputs.forEach( input => input.checkState() );

		if ( xrSession ) {

			const arrayCamera = renderer.xr.getCamera( camera );

			arrayCamera.getWorldDirection( this.viewDirection );

			this.viewDirection.normalize();

		} else {

			// update viewDirection according to mouse position on dom element

			vec1.crossVectors( this.viewDirection, camera.up );
			vec1.normalize();

			this.viewDirection.addScaledVector( vec1, Math.pow( mouse.x, 3 ) * this.mouseMovePower * 0.1 );

			vec1.crossVectors( vec1, this.viewDirection );

			this.viewDirection.addScaledVector( vec1, Math.pow( mouse.y, 3 ) * this.mouseMovePower * 0.1 );

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

		//

		this.xrInputs.forEach( ( xrInput ) => {

			xrInput.updateArc();

		} );

	}

	//

	this.setViewerSpace( new Group() );
	this.handleResize();

};

ImmersiveControls.prototype = Object.create( EventDispatcher.prototype );
ImmersiveControls.prototype.constructor = ImmersiveControls;

export { ImmersiveControls };
