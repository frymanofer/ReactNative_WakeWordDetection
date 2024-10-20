import { useState, useEffect, useCallback } from "react";
import {
    createKeyWordRNBridgeInstance,
    KeyWordRNBridgeInstance,
  } from '../rnkeywordspotter/KeyWordRNBridge';
  
type DetectionCallback = (event: any) => void;

const license = "MTczMjkxNzYwMDAwMA==-DDwBWs914KpHbWBBSqi28vhiM4l5CYG+YgS2n9Z3DMI=";
interface keyWordRNBridgeInstanceConfig {
    id: string;
    instance: KeyWordRNBridgeInstance;
}

interface instanceConfig {
    id: string;
    modelName: string;
    threshold: number;
    bufferCnt: number;
}

const keyWordRNBridgeInstances: keyWordRNBridgeInstanceConfig[] = [];

// Create an array of instance configurations
const instanceConfigs = [
    { id: 'hey_pango', modelName: 'hey_pango.onnx', threshold: 0.9999, bufferCnt: 2 },
    { id: 'i_want_to_park', modelName: 'i_want_to_park.onnx', threshold: 0.9999, bufferCnt: 2 },
    { id: 'need_help_now', modelName: 'need_help_now.onnx', threshold: 0.9999, bufferCnt: 2 },
    { id: 'instance2', modelName: 'model2.onnx', threshold: 0.9999, bufferCnt: 2 }
];

// Function to add a new instance dynamically
//async function addInstance(
//    conf: instanceConfig) 
async function addInstance(conf: instanceConfig, callback:any): KeyWordRNBridgeInstance | null {
    const id = conf.id;
    const instance = await createKeyWordRNBridgeInstance(id);
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
      console.log(`Instance ${id} detected: ${id}`);
      callback(phrase);
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
     * Load the keyword detection model
     * @param modelFileName - The name of the model file to load
     * @param threshold - The detection threshold
     * @param bufferCount - The number of audio buffers
     */
    const loadModel = useCallback(async (state, callback) => {
        console.log("loadModel()");
        let searchIds = [""];
        let element:any = null;
        const modelFileNameOptions = {
            'default': ["need_help_now.onnx"],
            'state1': ["hey_pango.onnx"],
            'state2': ["i_want_to_park.onnx","i_want_to_stop_park_model.onnx", "need_help_now.onnx"],
        };
        console.log("loadModel() - state == ", state)
        try {
            switch (state) {
                case 'state1':
                    searchIds = ['hey_pango'];
                    break;
                case 'state2':
                    searchIds = ['i_want_to_park', 'need_help_now'];
                    break;
            }
            searchIds.forEach(sId => {
                element = instanceConfigs.find(element => element.id === sId);
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
    const stopListening = useCallback(async () => {
        try {
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
        loadModel,
        stopListening,
    };
};

