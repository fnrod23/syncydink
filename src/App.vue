<template>
  <v-app id="app">
    <v-touch id="gesture-wrapper" @swiperight="SideNavOpen" @swipeleft="SideNavClose">
      <v-container fluid fill-height id="appcontainer">
        <header>
          <div id="sidetab-aligner"  @click="ToggleLeftSideNav">
            <div id="sidetab-arrow">
              <v-icon color="white">play_arrow</v-icon>
            </div>
            <div id="sidetab">
            </div>
          </div>
          <div v-if="videoFile === null && !showHapticsTimeline" class="patreon-button">
            <patreon-button></patreon-button>
          </div>
        </header>
        <v-layout
          class="intro-layout"
          v-if="videoFile === null && !showHapticsTimeline"
          justify-center
          align-center
          align-content-center>
          <v-flex xs10 lg8>
            <v-card class="intro-card">
              <v-layout row wrap>
		<v-flex class="intro-flex">
                  <v-card-media :src="require('../static/images/syncydinklogo.svg')" height="150px">
                  </v-card-media>
                  <v-card-title primary-title>
                    <div class="headline">Syncydink (Updated {{ config.short_build_date }})</div>
                  </v-card-title>
                  <v-card-text class="intro-text">
		    <p><strong>This is a FORK of the original syncydink with some experimental and work in progress features. The official version is hosted at <a href="https://syncydink.buttplug.world/">https://syncydink.buttplug.world/</a> !!!</strong></p>
                    <p>Welcome to Syncydink, the hardware synced movie player by <a href="https://buttplug.io">Team Buttplug</a>! (More info and documentation coming soon!)</p>
                    <p>To start:</p>
                    <ul>
                      <li>Click on the tab on the left</li>
                      <li>Hit the "Esc" key on your keyboard</li>
                      <li>(mobile only) Swipe right</li>
                    </ul>
                    <br/>
                    <p><b>Note:</b> VR Mode now requires two steps. Choose <i>Enable VR</i> on the side panel, then hit the <i>VR</i> button on the video controls to bring up VR mode.</p>
                    <br/>
                    <p>Have problems or questions? Try...</p>
                    <ul>
                      <li><a href="https://metafetish.club">Our forums!</a></li>
                      <li><a href="https://discord.buttplug.io">Our discord server!</a></li>
                      <li><a href="https://twitter.com/buttplugio">Our twitter account!</a></li>
                    </ul>
                  </v-card-text>
                </v-flex>
              </v-layout>
            </v-card>
          </v-flex>
        </v-layout>
        <v-layout id="video-encoder-container" column class="video-encoder-container">
          <v-flex id="video-container" v-if="videoFile">
            <video-player-component
              id="video-player"
              ref="videoPlayer"
              :videoFile="videoFile"
              :vrMode="vrMode"
              :loopVideo="loopVideo"
              :desiredPlayTime="this.desiredPlayTime"
              @videoPlaying="onPlay"
              @videoPaused="onPause"
              @timeUpdate="onTimeUpdate"
              @progress="onProgress"
              @videoLoaded="onVideoLoaded"
            />
          </v-flex>
          <v-flex v-if="showHapticsTimeline" id="video-encoder">
            <video-encoder-component
              ref="videoEncoder"
              :hapticsCommands="this.hapticsCommands"
              :currentPlayTime="this.currentPlayTime"
              @play="onPlay"
              @pause="onPause"
              @timeUpdate="onTimeUpdate"
              @inputTimeUpdate="onInputTimeUpdate"
              @dragStart="onDragStart"
              @dragStop="onDragStop"
            />
          </v-flex>
        </v-layout>
        <v-navigation-drawer
          temporary
          absolute
          v-model="menuOpened">
          <v-tabs>
            <v-tab href="#syncydink">
              Syncydink
            </v-tab>
            <v-tab href="#coyotepanel">
              Coyote
            </v-tab>
            <v-tab href="#buttplugpanel">
              Buttplug
            </v-tab>            
            <v-tab href="#aboutpanel">
              About
            </v-tab>
            <v-tabs-items>
              <v-tab-item id="syncydink">
                <v-layout column class="sidebar-form">
                  <v-flex>
                    <v-subheader>Video</v-subheader>
                    <!-- need file input here -->
                    <v-file-input
                      @file="SetVideoFile"
                      label="Choose Movie File"
                      webkitdirectory="true"
                      ></v-file-input>
                    <v-text-field
                      clearable
                      prepend-icon="video_library"
                      @change="SetVideoURL"
                      label="Youtube URL"></v-text-field>
                    <v-checkbox
                      v-model="loopVideo"
                      label="Loop Video" checked></v-checkbox>
                    <v-checkbox
                      v-model="vrMode"
                      label="Enable VR"></v-checkbox>
                  </v-flex>
                  <v-divider />
                  <v-flex>
                    <v-subheader>Haptics</v-subheader>
                    <!-- need file input here -->
                    <v-file-input
                      label="Choose Haptics File"
                      @file="SetHapticsFile"></v-file-input>
                    <v-checkbox
                      v-model="showHapticsTimeline"
                      label="Show Haptics Timeline"></v-checkbox>
                      <v-slider
                      v-bind:label="'Haptics Offset (' + hapticsOffsetMillis.toLocaleString() + 'ms)'"
            v-model="hapticsOffsetMillis"
            class="align-center"
            :max="1000"
            :min="0"
            :step="10"
          />
                  </v-flex>

                  <!-- <v-flex v-if="this.hapticCommandsSize != 0">
                       <ul class="haptics-info">
                       <li># of Haptic Commands Loaded: {{ this.hapticCommandsSize }}</li>
                       <li>Haptics Type: {{ this.hapticCommandsType }}</li>
                       </ul>
                       </v-flex> -->
                </v-layout>
              </v-tab-item>
              <v-tab-item id="coyotepanel">
                <v-layout column id="buttplug-connection-manager" class="buttplug-sidebar">
                  <v-subheader>Connection</v-subheader>
                  <v-flex row v-if="coyote !== null">
                    <v-text-field
                        aria-readonly="true"
                        label="Power A (set on device)"
                        class="form-text v-input--is-readonly"
                        v-model="coyotePower.powerA">
                    </v-text-field>
                    <v-text-field
                        aria-readonly="true"
                        label="Power B (set on device)"
                        class="form-text v-input--is-readonly"
                        v-model="coyotePower.powerB">
                    </v-text-field>
                  </v-flex>
                  <v-btn
                      v-if="coyote === null"
                      @click="connectCoyote">Connect</v-btn>
                  <v-subheader>Max. Power Factor</v-subheader>
                  <v-slider v-model="coyoteMaxAmp" hint="Values larger than 20 can lead to tingling" class="align-center" thumb-label :max="31" :min="1" persistent-hint />
                  <v-subheader>Pause Detection</v-subheader>
                  <v-checkbox v-model="coyotePause" label="Fade In/Out on detected Pauses" checked />
                  <v-slider v-model="coyotePauseDuration" class="align-center" v-bind:label="'Min Pause (' + coyotePauseDuration.toLocaleString() + 'ms)'" hint="Duration between two actions to be recognized as Pause" min="100"  max="5000" persistent-hint/>
                  <v-slider v-model="coyoteFadeDuration" class="align-center" v-bind:label="'Fade Duration (' + coyoteFadeDuration.toLocaleString() + 'ms)'" :min="50" :max="2500" />
                </v-layout>
              </v-tab-item>
              <v-tab-item id="buttplugpanel">
                <buttplug-panel
                  ref="buttplugPanel"
                  @deviceconnected="OnDeviceConnected"
                  @devicedisconnected="OnDeviceDisconnected"
                />
              </v-tab-item>              
              <v-tab-item id="aboutpanel">
                <p><b>Syncydink</b></p>
                <p>Version: <a :href="'https://github.com/metafetish/syncydink/tree/' + config.build_commit">{{ config.build_commit }}</a></p>
                <p>Updated: {{ config.build_date }}</p>
                <p>Buttplug v{{ config.buttplug_version }}</p>
                <p>Component v{{ config.component_version }}</p>
                <p>Developed By <a href="https://metafetish.com">Metafetish</a></p>
                <p>Open Source! <a href="https://github.com/metafetish/syncydink">Code available on Github</a></p>
                <p>We Like Money! <a href="https://patreon.com/qdot">Visit Our Patreon</a></p>
              </v-tab-item>
            </v-tabs-items>
          </v-tabs>
        </v-navigation-drawer>
      </v-container>
    </v-touch>
  </v-app>
</template>

<script lang="ts" src="./App.ts">
</script>

<style lang="css">

 /********************************/
 /* Fonts */
 /********************************/

 @font-face {
   font-family: 'Material Icons';
   font-style: normal;
   font-weight: 400;
   src: local('Material Icons'),
   local('MaterialIcons-Regular'),
   url(../static/fonts/MaterialIcons-Regular.woff2) format('woff2');
 }

 .material-icons {
   font-family: 'Material Icons';
   font-weight: normal;
   font-style: normal;
   font-size: 24px;  /* Preferred icon size */
   display: inline-block;
   line-height: 1;
   text-transform: none;
   letter-spacing: normal;
   word-wrap: normal;
   white-space: nowrap;
   direction: ltr;

   /* Support for all WebKit browsers. */
   -webkit-font-smoothing: antialiased;
   /* Support for Safari and Chrome. */
   text-rendering: optimizeLegibility;

   /* Support for Firefox. */
   -moz-osx-font-smoothing: grayscale;

   /* Support for IE. */
   font-feature-settings: 'liga';
 }

 /********************************/
 /* Basic HTML styles */
 /********************************/

 html, body {
   margin: 0;
   padding: 0;
   height: 100vh;
   width: 100vw;
 }

 body {
   overflow:hidden;
 }

 h1, h2 {
   font-weight: normal;
 }

 a {
   color: #42b983;
 }

 /********************************/
 /* App container styles */
 /********************************/

 #app {
   background-repeat: no-repeat;
   background-position: center;
   font-size: 16px;
   font-weight: 400;
   text-align: left;
   text-transform: none;
   font-family: Roboto,Noto Sans,Noto,sans-serif;
   -webkit-font-smoothing: antialiased;
   -moz-osx-font-smoothing: grayscale;
   color: #2c3e50;
 }

 /* Make our touch wrapper div take up the whole screen, but also make it
    fixed so that we don't have problems with readjustment snapping */
 #gesture-wrapper {
   position: fixed;
   height: 100%;
   width: 100%;
 }

 .patreon-button {
   position: absolute;
   bottom: 0;
   right: 0;
 }

 /********************************/
 /* Nav Drawer opener styles */
 /********************************/

 #sidetab-aligner {
   height: 100vh;
   display: flex;
   align-items: center;
   justify-content: center;
	 left: 0px;
   top: 0px;
	 position: fixed;
 }

 #sidetab {
	 background: #000;
   border: 2px solid #000;
	 height: 75px;
   left: 0;
	 width: 25px;
   border-top-right-radius: 15px;
   border-bottom-right-radius: 15px;
	 margin: 0;
	 padding: 0;
	 position: fixed;
	 display:block;
   z-index: 9998;
   cursor: pointer;
 }

 #sidetab-arrow {
   z-index: 9999;
   cursor: pointer;
 }

 /********************************/
 /* Intro Message */
 /********************************/

 .headline {
   text-align: center;
   width: 100%;
 }
 .intro-layout {
   min-width: 100vw;
   width: 100vw;
 }
 .intro-card {
   min-width: 100%;
   min-height: 0;
   max-height: 75vh;
   width: 100%;
 }

 .intro-flex {
   height: auto;
   min-height: 0;
   max-height: 75vh;
   width: 100%;
   overflow-y: auto;
   overflow-x: hidden;
 }

 .intro-text {
   max-height: 100%;
   font-size:16px;
 }

 /********************************/
 /* Misc application styles */
 /********************************/
 .video-encoder-container {
   height: 100%;
   display: flex;
   flex: 1;
 }

 #appcontainer {
   width: 100%;
   height: 100%;
   padding: 0px;
 }

 #video-player {
   background: #000;
   flex: 0 1 auto;
   display: flex;
   align-items: center;
   justify-content: center;
 }

</style>
<style src="vuetify/dist/vuetify.min.css"></style>
