import os
import json
import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageTk
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.pipeline import OCRPipeline
from src.config import Config

class AnnotationState:
    def __init__(self, gt_path):
        self.gt_path = gt_path
        self.ground_truth = self.load_ground_truth()
        
    def load_ground_truth(self):
        if os.path.exists(self.gt_path):
            try:
                with open(self.gt_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}
        
    def save_ground_truth(self):
        os.makedirs(os.path.dirname(self.gt_path), exist_ok=True)
        with open(self.gt_path, 'w', encoding='utf-8') as f:
            json.dump(self.ground_truth, f, indent=4)
            
    def update_field(self, image_path, field_name, value, status):
        if status == "PENDING":
            return # Never save unverified suggestions
            
        if image_path not in self.ground_truth:
            self.ground_truth[image_path] = {}
            
        if status in ["NOT_PRESENT", "UNREADABLE"]:
            value = None
            
        self.ground_truth[image_path][field_name] = {
            "value": value,
            "status": status
        }

FIELDS = [
    "category", "product_name", "mrp", "net_quantity", "manufacturing_date",
    "manufacturer_name", "manufacturer_address", 
    "packer_name", "packer_address",
    "importer_name", "importer_address",
    "consumer_care_name", "consumer_care_address", "consumer_care_phone", "consumer_care_email"
]

class AnnotationApp:
    def __init__(self, root, data_dir, gt_path):
        self.root = root
        self.root.title("SIH26034 Annotation Tool")
        self.data_dir = data_dir
        self.state = AnnotationState(gt_path)
        
        # VLM off for baseline generation
        Config.USE_VLM = False
        self.pipeline = OCRPipeline()
        self.images = self.get_all_images()
        self.current_idx = self.find_resume_index()
        
        self.setup_ui()
        self.load_image()
        
    def get_all_images(self):
        imgs = []
        for root_dir, _, files in os.walk(self.data_dir):
            for file in files:
                if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                    rel_path = os.path.relpath(os.path.join(root_dir, file), self.data_dir)
                    imgs.append(rel_path.replace("\\", "/"))
        return imgs
        
    def find_resume_index(self):
        for i, img in enumerate(self.images):
            if img not in self.state.ground_truth:
                return i
        return 0
            
    def setup_ui(self):
        self.paned = ttk.PanedWindow(self.root, orient=tk.HORIZONTAL)
        self.paned.pack(fill=tk.BOTH, expand=True)
        
        # Left frame: Image list & Preview
        self.left_frame = ttk.Frame(self.paned)
        self.paned.add(self.left_frame, weight=1)
        
        # Listbox for selection
        self.list_frame = ttk.Frame(self.left_frame)
        self.list_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(self.list_frame, text="Select Image (Gold Subset):").pack(side=tk.LEFT)
        self.img_var = tk.StringVar(value=self.images)
        self.listbox = tk.Listbox(self.list_frame, listvariable=self.img_var, height=5)
        self.listbox.pack(fill=tk.X, expand=True, pady=5)
        self.listbox.bind('<<ListboxSelect>>', self.on_list_select)
        
        self.lbl_info = ttk.Label(self.left_frame, text="", font=("Arial", 12, "bold"))
        self.lbl_info.pack(pady=5)
        
        self.canvas = tk.Canvas(self.left_frame, bg="gray")
        self.canvas.pack(fill=tk.BOTH, expand=True)
        
        # Select current idx in listbox
        if self.images:
            self.listbox.selection_set(self.current_idx)
            self.listbox.see(self.current_idx)

        # Right frame: Form
        self.right_frame = ttk.Frame(self.paned)
        self.paned.add(self.right_frame, weight=1)
        
        # Add a label mapping
        ttk.Label(self.right_frame, text="Human-Verified Gold Annotations", font=("Arial", 14, "bold")).grid(row=0, column=0, columnspan=3, pady=10)
        
        self.field_vars = {}
        row = 1
        for field in FIELDS:
            ttk.Label(self.right_frame, text=field).grid(row=row, column=0, sticky=tk.W, padx=5, pady=2)
            
            val_var = tk.StringVar()
            ent = ttk.Entry(self.right_frame, textvariable=val_var, width=30)
            ent.grid(row=row, column=1, padx=5, pady=2)
            
            status_var = tk.StringVar(value="PENDING")
            opts = ["PENDING", "VERIFIED", "NOT_PRESENT", "UNREADABLE"]
            menu = ttk.OptionMenu(self.right_frame, status_var, status_var.get(), *opts, command=lambda val, f=field: self.on_status_change(f, val))
            menu.grid(row=row, column=2, padx=5, pady=2)
            
            self.field_vars[field] = {"value": val_var, "status": status_var, "entry": ent}
            row += 1
            
        btn_frame = ttk.Frame(self.right_frame)
        btn_frame.grid(row=row, column=0, columnspan=3, pady=20)
        
        ttk.Button(btn_frame, text="Save Current", command=self.save_current).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="Save & Next", command=self.save_and_next).pack(side=tk.LEFT, padx=5)
        
        self.status_lbl = ttk.Label(self.right_frame, text="")
        self.status_lbl.grid(row=row+1, column=0, columnspan=3)
        
    def on_list_select(self, event):
        sel = self.listbox.curselection()
        if sel:
            self.save_current()
            self.current_idx = sel[0]
            self.load_image()
        
    def on_status_change(self, field, status):
        if status in ["NOT_PRESENT", "UNREADABLE"]:
            self.field_vars[field]["value"].set("")
            self.field_vars[field]["entry"].config(state=tk.DISABLED)
        else:
            self.field_vars[field]["entry"].config(state=tk.NORMAL)
            
    def load_image(self):
        if not self.images:
            messagebox.showinfo("Done", "No images found.")
            return
            
        rel_path = self.images[self.current_idx]
        self.lbl_info.config(text=f"Image {self.current_idx+1}/{len(self.images)}: {rel_path}")
        
        img_path = os.path.join(self.data_dir, rel_path)
        
        try:
            img = Image.open(img_path)
            img.thumbnail((800, 800))
            self.photo = ImageTk.PhotoImage(img)
            self.canvas.delete("all")
            self.canvas.create_image(0, 0, anchor=tk.NW, image=self.photo)
        except Exception as e:
            self.status_lbl.config(text=f"Error loading image: {e}")
            
        for f in FIELDS:
            self.field_vars[f]["value"].set("")
            self.field_vars[f]["status"].set("PENDING")
            self.field_vars[f]["entry"].config(state=tk.NORMAL)
            
        if rel_path in self.state.ground_truth:
            gt_data = self.state.ground_truth[rel_path]
            for f in FIELDS:
                if f in gt_data:
                    self.field_vars[f]["value"].set(gt_data[f].get("value") or "")
                    self.field_vars[f]["status"].set(gt_data[f].get("status", "VERIFIED"))
                    self.on_status_change(f, self.field_vars[f]["status"].get())
            self.status_lbl.config(text="Loaded verified ground truth.")
        else:
            self.status_lbl.config(text="Running OCR pipeline...")
            self.root.update()
            
            def run_pipeline():
                try:
                    out = self.pipeline.process_image(img_path, save_debug=False)
                    data = json.loads(out)
                    fields_data = data.get("fields", {})
                    
                    def set_val(f, d):
                        if d and d.get("status") == "FOUND":
                            self.field_vars[f]["value"].set(d.get("extracted_value", ""))
                            # IMPORTANT: Leave status as PENDING so user must verify
                    
                    self.root.after(0, lambda: set_val("product_name", fields_data.get("product_name")))
                    self.root.after(0, lambda: set_val("category", fields_data.get("category")))
                    self.root.after(0, lambda: set_val("mrp", fields_data.get("mrp")))
                    self.root.after(0, lambda: set_val("net_quantity", fields_data.get("net_quantity")))
                    self.root.after(0, lambda: set_val("manufacturing_date", fields_data.get("manufacturing_date")))
                    
                    if "manufacturer" in fields_data:
                        self.root.after(0, lambda: set_val("manufacturer_name", fields_data["manufacturer"].get("name")))
                        self.root.after(0, lambda: set_val("manufacturer_address", fields_data["manufacturer"].get("address")))
                        
                    if "consumer_care" in fields_data:
                        self.root.after(0, lambda: set_val("consumer_care_name", fields_data["consumer_care"].get("name")))
                        self.root.after(0, lambda: set_val("consumer_care_address", fields_data["consumer_care"].get("address")))
                        self.root.after(0, lambda: set_val("consumer_care_phone", fields_data["consumer_care"].get("phone")))
                        self.root.after(0, lambda: set_val("consumer_care_email", fields_data["consumer_care"].get("email")))
                        
                    self.root.after(0, lambda: self.status_lbl.config(text="OCR Complete. Please verify."))
                except Exception as e:
                    self.root.after(0, lambda: self.status_lbl.config(text=f"OCR Failed: {e}"))
                    
            threading.Thread(target=run_pipeline, daemon=True).start()
            
    def save_current(self):
        rel_path = self.images[self.current_idx]
        for f in FIELDS:
            status = self.field_vars[f]["status"].get()
            val = self.field_vars[f]["value"].get()
            self.state.update_field(rel_path, f, val, status)
        self.state.save_ground_truth()
            
    def save_and_next(self):
        self.save_current()
        if self.current_idx < len(self.images) - 1:
            self.current_idx += 1
            self.load_image()
        else:
            messagebox.showinfo("Done", "All images processed!")
            
    def prev_image(self):
        if self.current_idx > 0:
            self.save_current()
            self.current_idx -= 1
            self.load_image()

if __name__ == "__main__":
    DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "test_images")
    GT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "eval", "ground_truth.json")
    
    root = tk.Tk()
    app = AnnotationApp(root, DATA_DIR, GT_PATH)
    root.mainloop()
