( function () // begin closure
{
    window.AnalyticsManager = AnalyticsManager;

    function AnalyticsManager ()
    {
        this.engines = [];
        this.sessionStartTime = null;
        this.lastEventName = null;
        this.lastEventDescription = null;
        this.lastEventSessionTime = null;
        this.eventProperties = {};
        this.persistentEventProperties = {};
        this.sessionProperties = {};
        this.userProperties = {};
        this.propertyNamesMap = {};
    }
    AnalyticsManager.prototype.logMethod = console.log;

    var defaultInstance = null;
    AnalyticsManager.getInstance = function ()
    {
        var instance = defaultInstance;
        if ( !instance )
        {
            instance = new AnalyticsManager();
            defaultInstance = instance;
        }
        return instance;
    };
    AnalyticsManager.setInstance = function ( instance )
    {
        defaultInstance = instance;
    };

    var availableEngines = {};
    AnalyticsManager.addAvailableEngine = function ( name, constructor )
    {
        availableEngines[ name ] = constructor;
    };

    /* EVERYTHING RELATED TO INITIALIZATION */

    AnalyticsManager.prototype.registerAnalyticsEngine = function ( engineConstructor, token, engineParams )
    {
        engineParams.logMethod = this.logMethod;

        var analyticsEngine;
        try
        {
            analyticsEngine = new engineConstructor( token, engineParams );
        }
        catch ( event )
        {
            this.onRegisterAnalyticsEngineFailure( engineConstructor, token, engineParams, event );
        }

        this.engines.push( analyticsEngine );
    };


    AnalyticsManager.prototype.onRegisterAnalyticsEngineFailure = function ( engineConstructor, token, engineParams, errorEvent)
    {
        var debugOutput =
        {
            analyticsManager: this,
            analyticsEngineConstructor: engineConstructor,
            token: token,
            engineParams: engineParams,
            errorEvent: errorEvent
        };
        this.logMethod( "Failure while trying to register analytics engine. Relevant variables shall now be output in console.");
        console.log( debugOutput );
    };


    AnalyticsManager.prototype.init = function ( analyticsParams )
    {
        var engineName, engineConstructor;

        for ( engineName in availableEngines )
        {
            engineConstructor = availableEngines[ engineName ];
            if ( analyticsParams[ engineName ] && analyticsParams[ engineName ].enabled && engineConstructor )
                this.registerAnalyticsEngine( engineConstructor, null, analyticsParams[ engineName ] );
        }

        this.trackPrevEventInformation = analyticsParams.trackPrevEventInformation || false;
        this.trackPayers               = analyticsParams.trackPayers || false;
        this.paymentEvent              = analyticsParams.paymentEvent || "";
        this.propertyNamesMap          = analyticsParams.propertyNamesMap || {};
    };


    AnalyticsManager.prototype.setSessionStartTime = function ( sessionStartTime )
    {
        this.sessionStartTime = sessionStartTime;
    };



    /* EVERYTHING RELATED TO PROPERTIES */

    function setProperties( manager, target, source )
    {
        //var tempProperties = {};
        //copyFromAtoB( source, tempProperties );
        //manager.renameProperties( tempProperties );
        //copyFromAtoB( target, tempProperties );
        copyFromAtoB( source, target );
        manager.renameProperties( target );
        return target;
    }

    function setPropertiesAndAlsoInEngines ( manager, target, source, methodName )
    {
        var newProperties = setProperties( manager, target, source ),
            engines = manager.engines,
            numOfEngines = engines.length;

        if ( numOfEngines === 0 )
            return;

        for ( var i = 0; i < numOfEngines; i++ )
            engines[ i ][ methodName ]( newProperties );
    }

    AnalyticsManager.prototype.setEventProperties = function ( properties )
    {
        setProperties( this, this.eventProperties, properties );
    };


    AnalyticsManager.prototype.resetEventProperties = function ()
    {
        this.eventProperties = {};
    };


    AnalyticsManager.setPersistentEventProperties = function ( properties )
    {
        setPropertiesAndAlsoInEngines( this, this.persistentEventProperties, properties, "setPersistentEventProperties" );
    };


    AnalyticsManager.prototype.setSessionProperties = function ( properties )
    {
        setPropertiesAndAlsoInEngines( this, this.sessionProperties, properties, "setSessionProperties" );
    };


    AnalyticsManager.prototype.setUserProperties = function ( properties )
    {
        setPropertiesAndAlsoInEngines( this, this.userProperties, properties, "setUserProperties" );
    };


    AnalyticsManager.prototype.renameProperties = function ( targetProperties )
    {
        var keyOverrideMap = this.propertyNamesMap,
            value;
        for ( var key in targetProperties )
            if ( keyOverrideMap[ key ] )
            {
                value = targetProperties[ key ];
                delete targetProperties[ key ];
                targetProperties[ keyOverrideMap[ key ] ] = value;
            }
    };



    /* EVERYTHING RELATED TO TRACKING ONE EVENT */

    AnalyticsManager.prototype.trackEvent = function ( eventName, eventProperties, trackingParams )
    {
        var engines = this.engines,
            numOfEngines = engines.length;
        if ( numOfEngines === 0 || !eventName )
            return;

        this.setEventProperties( eventProperties );

        var allEventProperties = this.eventProperties;
        this.addLastEventInformationTo( allEventProperties );
        this.addSessionTimeTo( allEventProperties );

        for ( var i = 0; i < numOfEngines; i++ )
            engines[ i ].trackEvent( eventName, allEventProperties, this.persistentEventProperties,
                                     this.sessionProperties, this.userProperties, trackingParams );

        this.resetEventProperties();
        this.updateLastEventInformation( eventName, allEventProperties, trackingParams );

        if ( this.trackPayers && this.paymentEvent === eventName )
            this.setUserProperties( { isPayer: true } );
    };


    AnalyticsManager.prototype.addLastEventInformationTo = function ( targetObject )
    {
        if ( !this.trackPrevEventInformation )
            return;

        if ( this.lastEventName )
            targetObject.PrevEvent = this.lastEventName;

        if ( this.lastEventDescription )
            targetObject.PrevEventExt = this.lastEventName + " " + this.lastEventDescription;

        if ( this.lastEventSessionTime )
            targetObject.PrevEventSessionTime = this.lastEventSessionTime;

        if ( this.lastMajorEventName )
            targetObject.PrevMajorEvent = this.lastMajorEventName;

        if ( this.lastMajorEventDescription )
            targetObject.PrevMajorEventExt = this.lastMajorEventName + " " + this.lastMajorEventDescription;
    };


    AnalyticsManager.prototype.addSessionTimeTo = function ( targetObject )
    {
        if ( this.sessionStartTime )
        {
            var ms = new Date() - this.sessionStartTime;
            targetObject.SessionTime = Math.floor( ms / 1000 );
        }
    };


    AnalyticsManager.prototype.updateLastEventInformation = function ( eventName, eventProperties, trackingParams )
    {
        if ( !this.trackPrevEventInformation )
            return;

        this.lastEventName = eventName;
        if ( trackingParams && trackingParams.eventIsMajor )
            this.lastMajorEventName = eventName;

        if ( trackingParams && trackingParams.eventDescription )
        {
            this.lastEventDescription = trackingParams.eventDescription;
            if ( trackingParams.eventIsMajor )
                this.lastMajorEventDescription = trackingParams.eventDescription;
        }
    };


    /* EVERYTHING RELATED TO TRACKING USER */

    AnalyticsManager.prototype.identifyUser = function ( userId )
    {
        var engines = this.engines;
        for ( var i = 0, n = engines.length; i < n; i++ )
            engines[ i ].identifyUser( userId );
    };


    /* EVERYTHING RELATED TO CUSTOM HANDLERS */

    AnalyticsManager.prototype.onPageLoaded = function ()
    {
        this.setSessionStartTime( new Date() );
        this.trackEvent( "PageLoaded" );
    };


    AnalyticsManager.prototype.onFirstServerResponse = function ()
    {
        this.trackEvent( "SessionCreated" );
    };


    /* Legacy Compatibility */

    window.__setUserProperties = function ( properties )
    {
        AnalyticsManager.getInstance().setUserProperties( properties );
    };

    window.__setEventProperties = function ( properties )
    {
        AnalyticsManager.getInstance().setPersistentEventProperties( properties );
    };

    window.__trackEvent = function ( event, params, major, debug )
    {
        var eventName = event.name,
            trackingParams = {
                eventIsMajor: major,
                eventIsDebugEvent: debug,
                eventDescription: event.description
            };
        AnalyticsManager.getInstance().trackEvent( eventName, params, trackingParams );
    };


    window.__trackSession = function ()
    {
        //AnalyticsManager.defaultGlobalInstance.trackEvent( null, {}, { trackSession: true } );
    };

    window.__trackLevel = function ( level )
    {
        //AnalyticsManager.defaultGlobalInstance.trackEvent( "LevelUp", { UserLevel: level }, { trackLevel: true } );
    };

    window.__trackPayment = function ( paymentParams )
    {
        //AnalyticsManager.defaultGlobalInstance.trackEvent( "BankPayment", paymentParams, { trackPayment: true } );
    };

}()); // end closure

