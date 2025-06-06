import { useState, useEffect, useCallback } from "react";
import {
    createKeyWordRNBridgeInstance,
    KeyWordRNBridgeInstance,
  } from '../rnkeywordspotter/KeyWordRNBridge';
import { Platform } from "react-native";
  
type DetectionCallback = (event: any) => void;

const license = "MTc0NDY2NDQwMDAwMA==-m4g05tL50nMcnOp4mu6NghsgkfXk1ZNVTPo26+2/Z0E=";

interface keyWordRNBridgeInstanceConfig {
    id: string;
    instance: KeyWordRNBridgeInstance;
}

interface instanceConfig {
    id: string;
    modelName: string;
    threshold: number;
    bufferCnt: number;
    sticky: boolean;
}

const keyWordRNBridgeInstances: keyWordRNBridgeInstanceConfig[] = [];
function findInstanceById(id: string): keyWordRNBridgeInstanceConfig | undefined {
    return keyWordRNBridgeInstances.find(config => config.id === id);
}

// Create an array of instance configurations
const instanceConfigs:instanceConfig[] = [
    { id: 'genious', modelName: 'genious.onnx', threshold: 0.9999, bufferCnt: 1, sticky: false },
    { id: 'i_want_to_park', modelName: 'i_want_to_park.onnx', threshold: 0.9999, bufferCnt: 2, sticky: false  },
    { id: 'need_help_now', modelName: 'need_help_now.onnx', threshold: 0.99995, bufferCnt: 5, sticky: false  },
    { id: 'step_back', modelName: 'step_back.onnx', threshold: 0.9999, bufferCnt: 2, sticky: true  },
    { id: 'electric_vehicle_parking', modelName: 'electric_vehicle_parking.onnx', threshold: 0.9999, bufferCnt: 2 , sticky: false },
    { id: 'nearest_gaz_station', modelName: 'nearest_gaz_station.onnx', threshold: 0.9999, bufferCnt: 6 , sticky: false },
    { id: 'i_want_to_stop_park', modelName: 'i_want_to_stop_park.onnx', threshold: 0.99999, bufferCnt: 7 , sticky: false }
];

async function removeListeners() {
    keyWordRNBridgeInstances.forEach(element => {
        const instance = element.instance;
        instance.removeListeners();
    }); 
}

async function addCBToAll(callback: any) {
    keyWordRNBridgeInstances.forEach(element => {
        const instance = element.instance;
        const id = element.id;
        instance.onKeywordDetectionEvent((phrase: string) => {
            console.log(`Instance ${id} detected: ${id} with phrase`, phrase);
            // callback(phrase); Does not work on IOS
            callback(id);
          });
    }); 
}

    // Function to add a new instance dynamically
//async function addInstance(
//    conf: instanceConfig) 
async function addInstance(conf: instanceConfig, callback:any): KeyWordRNBridgeInstance | null {
    const id = conf.id;
    const instanceConf = findInstanceById(id);
    if (instanceConf != null) {
        console.log("Found Instance: ", id, "starting to listen");
        const instance = instanceConf.instance;
        instance.startKeywordDetection(conf.threshold);
        return instance;
    }
    const instance = await createKeyWordRNBridgeInstance(id, conf.sticky);
    let isLicesed = false;
  
    if (!instance) {
        console.error(`Failed to create instance ${id}`);
        return null;
    }
    console.log(`Instance ${id} created ${instance}`);
    await instance.createInstance(conf.modelName, conf.threshold, conf.bufferCnt);
    console.log(`Instance ${id} createInstance() called`);

    isLicesed = await instance.setKeywordDetectionLicense(license);
    console.log(`Instance ${id} created ${instance} and licensed ${isLicesed}`);
  
    keyWordRNBridgeInstances.push({ id, instance });
      // Set up event listener
    instance.onKeywordDetectionEvent((phrase: string) => {
      console.log(`Instance ${id} detected: ${id} with phrase`, phrase);
      // callback(phrase); Does not work on IOS
      callback(id);
    });
    console.log(`Instance ${id} calling startKeywordDetection()`);
    instance.startKeywordDetection(conf.threshold);
    console.log(`Instance ${id} started Keyword Detection`);
    return instance;
  }
  
  // Function to remove an instance dynamically
function removeInstance(id: string): void {
    const instanceIndex = keyWordRNBridgeInstances.findIndex((item) => item.id === id);
  
    if (instanceIndex !== -1) {
      const { instance } = keyWordRNBridgeInstances[instanceIndex];
  
      instance
        .stopKeywordDetection()
        .then(() => instance.destroyInstance())
        .then(() => {
          instance.removeListeners();
          console.log(`Instance ${id} stopped and destroyed`);
          keyWordRNBridgeInstances.splice(instanceIndex, 1);
        })
        .catch((error: Error) =>
          console.error(`Error stopping instance ${id}: ${error.message}`)
        );
    } else {
      console.error(`Instance ${id} not found`);
    }
  }
  
/**
 * Custom hook for handling keyword detection using KeyWordRNBridge
 * @returns An object with functions and state for keyword detection
 */
export const useModel = () => {
    // State to track whether the keyword detection is currently active
    const [isListening, setIsListening] = useState(false);
    let currentEventListener: any[] = [];
    /**
     * Set the keyword detection license
     * @param licenseKey - The license key
     */
    // const setLicense = useCallback(async (licenseKey: any) => {
    //     try {
    //         await KeyWordRNBridge.setKeywordDetectionLicense(licenseKey);
    //     } catch (error) {
    //         console.error("[useModel] Error setting license:", error);
    //     }
    // }, []);

    /**
     * replace all call backs
     * @callback
     */
    const replaceAllCB = useCallback(async (callback:any) => {
        console.log("replaceAllCB()");
        removeListeners();
        addCBToAll(callback);
    }, []);
            /**
     * Load the keyword detection model
     * @param modelFileName - The name of the model file to load
     * @param threshold - The detection threshold
     * @param bufferCount - The number of audio buffers
     */
    const loadModel = useCallback(async (state, callback) => {
        console.log("loadModel()");
        let searchIds = [""];
        let element:any = null;
        console.log("loadModel() - state == ", state)
        try {
            switch (state) {
                case 'state1':
                    searchIds = ['genious'];
                    break;
                case 'all':
                    searchIds = ['genious', 'i_want_to_park', 'need_help_now',
                        'nearest_gaz_station', 'i_want_to_stop_park', 'electric_vehicle_parking', 'step_back'];
                    //searchIds = ['i_want_to_park', 'i_want_to_stop_park', 'need_help_now', 'step_back'];
                    break;
                case 'state2':
                    searchIds = ['i_want_to_park', 'need_help_now',
                        'nearest_gaz_station', 'i_want_to_stop_park', 'electric_vehicle_parking', 'step_back'];
                    //searchIds = ['i_want_to_park', 'i_want_to_stop_park', 'need_help_now', 'step_back'];
                    break;
                case 'step_back':
                searchIds = ['step_back'];
                }
            //stopListening();
            searchIds.forEach(sId => {
                element = instanceConfigs.find(element => element.id === sId);
                if (element == null || element == undefined) {
                    console.error('element id' + sId + " not found in instanceConfigs");
                    return;
                }
                console.log('element:', element);
                const id = addInstance(element, callback);
            });
        } catch (error) {
            console.error("[useModel] Error loading model:", error);
        }
    }, []);

    /**
     * Stop listening for the keyword
     */
    const startListening = useCallback(async () => {
        try {
            keyWordRNBridgeInstances.forEach(element => {
                const instance = element.instance;
                instance.startKeywordDetection();
                /*if (instance.isSticky == false) {
                    instance.stopKeywordDetection();
                } else if (Platform.OS != 'ios') {
                    instance.stopKeywordDetection();
                }*/
            }); 
            setIsListening(true);
        } catch (error) {
            console.error("Error starting keyword detection:", error);
        }
    }, []);
    
    /**
     * Stop listening for the keyword
     */
    const stopListening = useCallback(async () => {
        try {
            keyWordRNBridgeInstances.forEach(element => {
                const instance = element.instance;
                instance.stopKeywordDetection();
                /*if (instance.isSticky == false) {
                    instance.stopKeywordDetection();
                } else if (Platform.OS != 'ios') {
                    instance.stopKeywordDetection();
                }*/
            }); 
            setIsListening(false);
        } catch (error) {
            console.error("Error stopping keyword detection:", error);
        }
    }, []);

    /**
     * Cleanup effect to stop listening when the component unmounts
     * or when the isListening state changes
     */
    useEffect(() => {
        console.log("isListening updated:", isListening);
        return () => {
            if (isListening) {
                stopListening();
            }
        };
    }, [isListening, stopListening]);

    // Return an object with the necessary functions and state
    return {
        isListening,
        // setLicense,
        startListening,
        replaceAllCB,
        loadModel,
        stopListening,
    };
};

