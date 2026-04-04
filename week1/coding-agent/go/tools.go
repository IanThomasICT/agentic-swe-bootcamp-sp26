package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/openai/openai-go/shared" // not needed with anthropic (types are top-level)
)

// --- Tool Definitions ---

type ToolDefinition struct {
	Name        string
	Description string
	Parameters  shared.FunctionParameters                   // anthropic.ToolInputSchemaParam -> openai shared.FunctionParameters
	Function    func(input json.RawMessage) (string, error) // same signature in both
}

// read_file

var ReadFileDefinition = ToolDefinition{
	Name:        "read_file",
	Description: "Read the contents of a given relative file path. Use this when you want to see what's inside a file. Do not use this with directory names.",
	Parameters: shared.FunctionParameters{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "The relative path of a file in the working directory.",
			},
		},
		"required": []string{"path"},
	},
	Function: ReadFile,
}

type ReadFileInput struct {
	Path string `json:"path"`
}

func ReadFile(input json.RawMessage) (string, error) {
	var ri ReadFileInput
	if err := json.Unmarshal(input, &ri); err != nil {
		return "", err
	}

	content, err := os.ReadFile(ri.Path)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// list_files

var ListFilesDefinition = ToolDefinition{
	Name:        "list_files",
	Description: "List files and directories at a given path. If no path is provided, lists files in the current directory.",
	Parameters: shared.FunctionParameters{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "Optional relative path to list files from. Defaults to current directory if not provided.",
			},
		},
	},
	Function: ListFiles,
}

type ListFilesInput struct {
	Path string `json:"path,omitempty"`
}

func ListFiles(input json.RawMessage) (string, error) {
	var li ListFilesInput
	if err := json.Unmarshal(input, &li); err != nil {
		return "", err
	}

	dir := "."
	if li.Path != "" {
		dir = li.Path
	}

	var files []string
	err := filepath.Walk(dir, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		relPath, err := filepath.Rel(dir, p)
		if err != nil {
			return err
		}
		if relPath != "." {
			if info.IsDir() {
				files = append(files, relPath+"/")
			} else {
				files = append(files, relPath)
			}
		}
		return nil
	})
	if err != nil {
		return "", err
	}

	result, err := json.Marshal(files)
	if err != nil {
		return "", err
	}
	return string(result), nil
}

// edit_file

var EditFileDefinition = ToolDefinition{
	Name: "edit_file",
	Description: `Make edits to a text file.

Replaces 'old_str' with 'new_str' in the given file. 'old_str' and 'new_str' MUST be different from each other.

If the file specified with path doesn't exist, it will be created.`,
	Parameters: shared.FunctionParameters{
		"type": "object",
		"properties": map[string]any{
			"path": map[string]any{
				"type":        "string",
				"description": "The path to the file",
			},
			"old_str": map[string]any{
				"type":        "string",
				"description": "Text to search for - must match exactly and must only have one match exactly",
			},
			"new_str": map[string]any{
				"type":        "string",
				"description": "Text to replace old_str with",
			},
		},
		"required": []string{"path", "old_str", "new_str"},
	},
	Function: EditFile,
}

type EditFileInput struct {
	Path   string `json:"path"`
	OldStr string `json:"old_str"`
	NewStr string `json:"new_str"`
}

func EditFile(input json.RawMessage) (string, error) {
	var ei EditFileInput
	if err := json.Unmarshal(input, &ei); err != nil {
		return "", err
	}

	if ei.Path == "" || ei.OldStr == ei.NewStr {
		return "", fmt.Errorf("invalid input parameters")
	}

	content, err := os.ReadFile(ei.Path)
	if err != nil {
		if os.IsNotExist(err) && ei.OldStr == "" {
			return createNewFile(ei.Path, ei.NewStr)
		}
		return "", err
	}

	oldContent := string(content)
	newContent := strings.Replace(oldContent, ei.OldStr, ei.NewStr, -1)

	if oldContent == newContent && ei.OldStr != "" {
		return "", fmt.Errorf("old_str not found in file")
	}

	if err := os.WriteFile(ei.Path, []byte(newContent), 0644); err != nil {
		return "", err
	}
	return "OK", nil
}

func createNewFile(filePath, content string) (string, error) {
	dir := path.Dir(filePath)
	if dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return "", fmt.Errorf("failed to create directory: %w", err)
		}
	}

	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	return fmt.Sprintf("Successfully created file %s", filePath), nil
}
